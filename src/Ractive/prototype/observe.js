import runloop from '../../global/runloop';
import { isArray, isEqual, isObject } from '../../utils/is';
import { splitKeypath } from '../../shared/keypaths';
import { cancel } from '../../shared/methodCallers';
import resolveReference from '../../view/resolvers/resolveReference';

export default function observe ( keypath, callback, options ) {
	let observers = [];
	let map;

	if ( isObject( keypath ) ) {
		map = keypath;
		options = callback || {};

		Object.keys( map ).forEach( keypath => {
			const callback = map[ keypath ];

			keypath.split( ' ' ).forEach( keypath => {
				observers.push( createObserver( this, keypath, callback, options ) );
			});
		});
	}

	else {
		let keypaths;

		if ( typeof keypath === 'function' ) {
			options = callback;
			callback = keypath;
			keypaths = [ '' ];
		} else {
			keypaths = keypath.split( ' ' );
		}

		keypaths.forEach( keypath => {
			observers.push( createObserver( this, keypath, callback, options || {} ) );
		});
	}

	// add observers to the Ractive instance, so they can be
	// cancelled on ractive.teardown()
	this._observers.push.apply( this._observers, observers );

	return {
		cancel () {
			observers.forEach( cancel );
		}
	};
}

function createObserver ( ractive, keypath, callback, options ) {
	const viewmodel = ractive.viewmodel;

	const keys = splitKeypath( keypath );
	const wildcardIndex = keys.indexOf( '*' );

	// normal keypath - no wildcards
	if ( !~wildcardIndex ) {
		const key = keys[0];

		if ( !viewmodel.has( key ) ) {
			// if this is an inline component, we may need to create an implicit mapping
			if ( ractive.component ) {
				const model = resolveReference( ractive.component.parentFragment, key );
				if ( model ) viewmodel.map( key, model );
			}
		}

		const model = viewmodel.joinAll( keys );
		return new Observer( options.context || ractive, model, callback, options );
	}

	// pattern observers - more complex case
	const baseModel = wildcardIndex === 0 ?
		viewmodel :
		viewmodel.joinAll( keys.slice( 0, wildcardIndex ) );

	return new PatternObserver( options.context || ractive, baseModel, keys.splice( wildcardIndex ), callback, options );
}

class Observer {
	constructor ( context, model, callback, options ) {
		this.context = context;
		this.model = model;
		this.keypath = model.getKeypath();
		this.callback = callback;

		this.oldValue = undefined;
		this.newValue = model.get();

		this.defer = options.defer;
		this.once = options.once;
		this.strict = options.strict;

		this.dirty = false;

		if ( options.init !== false ) {
			this.dispatch();
		} else {
			this.oldValue = this.newValue;
		}

		model.register( this );
	}

	cancel () {
		this.model.unregister( this );
	}

	dispatch () {
		this.callback.call( this.context, this.newValue, this.oldValue, this.keypath );
		this.oldValue = this.newValue;
		this.dirty = false;
	}

	handleChange () {
		if ( !this.dirty ) {
			this.newValue = this.model.get();

			if ( this.strict && this.newValue === this.oldValue ) return;

			runloop.addObserver( this, this.defer );
			this.dirty = true;

			if ( this.once ) this.cancel();
		}
	}
}

class PatternObserver {
	constructor ( context, baseModel, keys, callback, options ) {
		this.context = context;
		this.baseModel = baseModel;
		this.keys = keys;
		this.callback = callback;

		const pattern = keys.join( '\\.' ).replace( /\*/g, '(.+)' );
		const baseKeypath = baseModel.getKeypath();
		this.pattern = new RegExp( `^${baseKeypath ? baseKeypath + '\\.' : ''}${pattern}$` );

		this.oldValues = {};
		this.newValues = {};

		this.defer = options.defer;
		this.once = options.once;
		this.strict = options.strict;

		this.dirty = false;

		const models = baseModel.findMatches( this.keys );

		models.forEach( model => {
			this.newValues[ model.getKeypath() ] = model.get();
		});

		if ( options.init !== false ) {
			this.dispatch();
		} else {
			this.oldValues = this.newValues;
		}

		if ( baseModel.isRoot && keys.length === 1 && keys[0] === '*' ) {
			models.forEach( model => model.register( this ) );
		}
		else {
			baseModel.register( this );
		}
	}

	cancel () {
		this.baseModel.unregister( this );
	}

	dispatch () {
		Object.keys( this.newValues ).forEach( keypath => {
			if ( this.newKeys && !this.newKeys[ keypath ] ) return;

			const newValue = this.newValues[ keypath ];
			const oldValue = this.oldValues[ keypath ];

			if ( this.strict && newValue === oldValue ) return;
			if ( isEqual( newValue, oldValue ) ) return;

			const wildcards = this.pattern.exec( keypath ).slice( 1 );
			const args = [ newValue, oldValue, keypath ].concat( wildcards );

			this.callback.apply( this.context, args );
		});

		this.oldValues = this.newValues;
		this.newKeys = null;
		this.dirty = false;
	}

	shuffle( newIndices ) {
		if ( !isArray( this.baseModel.value ) ) return;

		const base = this.baseModel.getKeypath();
		const max = this.baseModel.value.length;
		const suffix = this.keys.length > 1 ? '.' + this.keys.slice( 1 ).join( '.' ) : '';

		this.newKeys = {};
		for ( let i = 0; i < newIndices.length; i++ ) {
			if ( newIndices[ i ] === -1 || newIndices[ i ] === i ) continue;
			this.newKeys[ `${base}.${i}${suffix}` ] = true;
		}

		for ( let i = newIndices.touchedFrom; i < max; i++ ) {
			this.newKeys[ `${base}.${i}${suffix}` ] = true;
		}
	}

	handleChange () {
		if ( !this.dirty ) {
			this.newValues = {};

			// handle case where previously extant keypath no longer exists -
			// observer should still fire, with undefined as new value
			// TODO huh. according to the test suite that's not the case...
			// Object.keys( this.oldValues ).forEach( keypath => {
			// 	this.newValues[ keypath ] = undefined;
			// });

			this.baseModel.findMatches( this.keys ).forEach( model => {
				const keypath = model.getKeypath();
				this.newValues[ keypath ] = model.get();
			});

			runloop.addObserver( this, this.defer );
			this.dirty = true;

			if ( this.once ) this.cancel();
		}
	}
}
