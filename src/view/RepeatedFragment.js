import Fragment from './Fragment';
import { createDocumentFragment } from '../utils/dom';
import { isArray, isObject } from '../utils/is';
import { findMap } from '../utils/array';
import { toEscapedString, toString, destroyed, shuffled, unbind, unrender, unrenderAndDestroy, update } from '../shared/methodCallers';

export default class RepeatedFragment {
	constructor ( options ) {
		this.parent = options.owner._parentFragment;

		// bit of a hack, so reference resolution works without another
		// layer of indirection
		this._parentFragment = this;
		this.owner = options.owner;
		this.ractive = this.parent.ractive;

		// encapsulated styles should be inherited until they get applied by an element
		this.cssIds = 'cssIds' in options ? options.cssIds : ( this.parent ? this.parent.cssIds : null );

		this.context = null;
		this.rendered = false;
		this._iterations = [];

		this._template = options._template;

		this.indexRef = options.indexRef;
		this.keyRef = options.keyRef;

		this._pendingNewIndices = null;
		this._previousIterations = null;

		// track array versus object so updates of type rest
		this.isArray = false;
	}

	bind ( context ) {
		this.context = context;
		const value = context.get();

		// {{#each array}}...
		if ( this.isArray = isArray( value ) ) {
			// we can't use map, because of sparse arrays
			this._iterations = [];
			const max = value.length;
			for ( let i = 0; i < max; i += 1 ) {
				this._iterations[i] = this.createIteration( i, i );
			}
		}

		// {{#each object}}...
		else if ( isObject( value ) ) {
			this.isArray = false;

			// TODO this is a dreadful hack. There must be a neater way
			if ( this.indexRef ) {
				const refs = this.indexRef.split( ',' );
				this.keyRef = refs[0];
				this.indexRef = refs[1];
			}

			this._iterations = Object.keys( value ).map( ( key, index ) => {
				return this.createIteration( key, index );
			});
		}

		return this;
	}

	bubble () {
		this.owner.bubble();
	}

	createIteration ( key, index ) {
		const fragment = new Fragment({
			owner: this,
			_template: this._template
		});

		// TODO this is a bit hacky
		fragment.key = key;
		fragment.index = index;
		fragment.isIteration = true;

		const model = this.context.joinKey( key );

		// set up an iteration alias if there is one
		if ( this.owner._template.z ) {
			fragment.aliases = {};
			fragment.aliases[ this.owner._template.z[0].n ] = model;
		}

		return fragment.bind( model );
	}

	destroyed () {
		this._iterations.forEach( destroyed );
	}

	detach () {
		const docFrag = createDocumentFragment();
		this._iterations.forEach( fragment => docFrag.appendChild( fragment.detach() ) );
		return docFrag;
	}

	find ( selector, options ) {
		return findMap( this._iterations, i => i.find( selector, options ) );
	}

	findAll ( selector, query ) {
		return this._iterations.forEach( i => i.findAll( selector, query ) );
	}

	findComponent ( name, options ) {
		return findMap( this._iterations, i => i.findComponent( name, options ) );
	}

	findAllComponents ( name, query ) {
		return this._iterations.forEach( i => i.findAllComponents( name, query ) );
	}

	findNextNode ( iteration ) {
		if ( iteration.index < this._iterations.length - 1 ) {
			for ( let i = iteration.index + 1; i < this._iterations.length; i++ ) {
				const node = this._iterations[ i ].firstNode( true );
				if ( node ) return node;
			}
		}

		return this.owner.findNextNode();
	}

	firstNode ( skipParent ) {
		return this._iterations[0] ? this._iterations[0].firstNode( skipParent ) : null;
	}

	rebinding ( next ) {
		this.context = next;
		this._iterations.forEach( fragment => {
			const model = next ? next.joinKey( fragment.key ) : undefined;
			fragment.context = model;
			if ( this.owner._template.z ) {
				fragment.aliases = {};
				fragment.aliases[ this.owner._template.z[0].n ] = model;
			}
		});
	}

	render ( target, occupants ) {
		// TODO use docFrag.cloneNode...

		if ( this._iterations ) {
			this._iterations.forEach( fragment => fragment.render( target, occupants ) );
		}

		this.rendered = true;
	}

	shuffle ( newIndices ) {
		if ( !this._pendingNewIndices ) this._previousIterations = this._iterations.slice();

		if ( !this._pendingNewIndices ) this._pendingNewIndices = [];

		this._pendingNewIndices.push( newIndices );

		const iterations = [];

		newIndices.forEach( ( newIndex, oldIndex ) => {
			if ( newIndex === -1 ) return;

			const fragment = this._iterations[ oldIndex ];
			iterations[ newIndex ] = fragment;

			if ( newIndex !== oldIndex && fragment ) fragment.dirty = true;
		});

		this._iterations = iterations;

		this.bubble();
	}

	shuffled () {
		this._iterations.forEach( shuffled );
	}

	toString ( escape ) {
		return this._iterations ?
			this._iterations.map( escape ? toEscapedString : toString ).join( '' ) :
			'';
	}

	unbind () {
		this._iterations.forEach( unbind );
		return this;
	}

	unrender ( shouldDestroy ) {
		this._iterations.forEach( shouldDestroy ? unrenderAndDestroy : unrender );
		if ( this._pendingNewIndices && this._previousIterations ) {
			this._previousIterations.forEach( fragment => {
				if ( fragment.rendered ) shouldDestroy ? unrenderAndDestroy( fragment ) : unrender( fragment );
			});
		}
		this.rendered = false;
	}

	// TODO smart update
	update () {
		// skip dirty check, since this is basically just a facade

		if ( this._pendingNewIndices ) {
			this.updatePostShuffle();
			return;
		}

		if ( this.updating ) return;
		this.updating = true;

		const value = this.context.get();
		const wasArray = this.isArray;

		let toRemove;
		let oldKeys;
		let reset = true;
		let i;

		if ( this.isArray = isArray( value ) ) {
			if ( wasArray ) {
				reset = false;
				if ( this._iterations.length > value.length ) {
					toRemove = this._iterations.splice( value.length );
				}
			}
		} else if ( isObject( value ) && !wasArray ) {
			reset = false;
			toRemove = [];
			oldKeys = {};
			i = this._iterations.length;

			while ( i-- ) {
				const fragment = this._iterations[i];
				if ( fragment.key in value ) {
					oldKeys[ fragment.key ] = true;
				} else {
					this._iterations.splice( i, 1 );
					toRemove.push( fragment );
				}
			}
		}

		if ( reset ) {
			toRemove = this._iterations;
			this._iterations = [];
		}

		if ( toRemove ) {
			toRemove.forEach( fragment => {
				fragment.unbind();
				fragment.unrender( true );
			});
		}

		// update the remaining ones
		this._iterations.forEach( update );

		// add new iterations
		const newLength = isArray( value ) ?
			value.length :
			isObject( value ) ?
				Object.keys( value ).length :
				0;

		let docFrag;
		let fragment;

		if ( newLength > this._iterations.length ) {
			docFrag = this.rendered ? createDocumentFragment() : null;
			i = this._iterations.length;

			if ( isArray( value ) ) {
				while ( i < value.length ) {
					fragment = this.createIteration( i, i );

					this._iterations.push( fragment );
					if ( this.rendered ) fragment.render( docFrag );

					i += 1;
				}
			}

			else if ( isObject( value ) ) {
				// TODO this is a dreadful hack. There must be a neater way
				if ( this.indexRef && !this.keyRef ) {
					const refs = this.indexRef.split( ',' );
					this.keyRef = refs[0];
					this.indexRef = refs[1];
				}

				Object.keys( value ).forEach( key => {
					if ( !oldKeys || !( key in oldKeys ) ) {
						fragment = this.createIteration( key, i );

						this._iterations.push( fragment );
						if ( this.rendered ) fragment.render( docFrag );

						i += 1;
					}
				});
			}

			if ( this.rendered ) {
				const parentNode = this.parent.findParentNode();
				const anchor = this.parent.findNextNode( this.owner );

				parentNode.insertBefore( docFrag, anchor );
			}
		}

		this.updating = false;
	}

	updatePostShuffle () {
		const newIndices = this._pendingNewIndices[ 0 ];

		// map first shuffle through
		this._pendingNewIndices.slice( 1 ).forEach( indices => {
			newIndices.forEach( ( newIndex, oldIndex ) => {
				newIndices[ oldIndex ] = indices[ newIndex ];
			});
		});

		// This algorithm (for detaching incorrectly-ordered fragments from the DOM and
		// storing them in a document fragment for later reinsertion) seems a bit hokey,
		// but it seems to work for now
		const len = this.context.get().length;
		const oldLen = this._previousIterations.length;
		const removed = {};
		let i;

		newIndices.forEach( ( newIndex, oldIndex ) => {
			const fragment = this._previousIterations[ oldIndex ];
			this._previousIterations[ oldIndex ] = null;

			if ( newIndex === -1 ) {
				removed[ oldIndex ] = fragment;
			} else if ( fragment.index !== newIndex ) {
				const model = this.context.joinKey( newIndex );
				fragment.index = newIndex;
				fragment.context = model;
				if ( this.owner._template.z ) {
					fragment.aliases = {};
					fragment.aliases[ this.owner._template.z[0].n ] = model;
				}
			}
		});

		// if the array was spliced outside of ractive, sometimes there are leftover fragments not in the newIndices
		this._previousIterations.forEach( ( frag, i ) => {
			if ( frag ) removed[ i ] = frag;
		});

		// create new/move existing iterations
		const docFrag = this.rendered ? createDocumentFragment() : null;
		const parentNode = this.rendered ? this.parent.findParentNode() : null;

		const contiguous = 'startIndex' in newIndices;
		i = contiguous ? newIndices.startIndex : 0;

		for ( i; i < len; i++ ) {
			const frag = this._iterations[i];

			if ( frag && contiguous ) {
				// attach any built-up iterations
				if ( this.rendered ) {
					if ( removed[i] ) docFrag.appendChild( removed[i].detach() );
					if ( docFrag.childNodes.length  ) parentNode.insertBefore( docFrag, frag.firstNode() );
				}
				continue;
			}

			if ( !frag ) this._iterations[i] = this.createIteration( i, i );

			if ( this.rendered ) {
				if ( removed[i] ) docFrag.appendChild( removed[i].detach() );

				if ( frag ) docFrag.appendChild( frag.detach() );
				else {
					this._iterations[i].render( docFrag );
				}
			}
		}

		// append any leftovers
		if ( this.rendered ) {
			for ( i = len; i < oldLen; i++ ) {
				if ( removed[i] ) docFrag.appendChild( removed[i].detach() );
			}

			if ( docFrag.childNodes.length ) {
				parentNode.insertBefore( docFrag, this.owner.findNextNode() );
			}
		}

		// trigger removal on old nodes
		Object.keys( removed ).forEach( k => removed[k].unbind().unrender( true ) );

		this._iterations.forEach( update );

		this._pendingNewIndices = null;

		this.shuffled();
	}
}
