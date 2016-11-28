import Binding from './Binding';
import { isNumeric } from '../../../../utils/is';
import handleDomEvent from './handleDomEvent';

function handleBlur () {
	handleDomEvent.call( this );

	const value = this._ractive.binding.model.get();
	this.value = value == undefined ? '' : value;
}

function handleDelay ( delay ) {
	let timeout;

	return function () {
		if ( timeout ) clearTimeout( timeout );

		timeout = setTimeout( () => {
			const binding = this._ractive.binding;
			if ( binding.rendered ) handleDomEvent.call( this );
			timeout = null;
		}, delay );
	};
}

export default class GenericBinding extends Binding {
	getInitialValue () {
		return '';
	}

	getValue () {
		return this.node.value;
	}

	render () {
		super.render();

		// any lazy setting for this element overrides the root
		// if the value is a number, it's a timeout
		let lazy = this.ractive.lazy;
		let timeout = false;

		if ( 'lazy' in this._element ) {
			lazy = this._element.lazy;
		}

		if ( isNumeric( lazy ) ) {
			timeout = +lazy;
			lazy = false;
		}

		this.handler = timeout ? handleDelay( timeout ) : handleDomEvent;

		const node = this.node;

		node.addEventListener( 'change', handleDomEvent, false );

		if ( !lazy ) {
			node.addEventListener( 'input', this.handler, false );

			if ( node.attachEvent ) {
				node.addEventListener( 'keyup', this.handler, false );
			}
		}

		node.addEventListener( 'blur', handleBlur, false );
	}

	unrender () {
		const node = this._element.node;
		this.rendered = false;

		node.removeEventListener( 'change', handleDomEvent, false );
		node.removeEventListener( 'input', this.handler, false );
		node.removeEventListener( 'keyup', this.handler, false );
		node.removeEventListener( 'blur', handleBlur, false );
	}
}
