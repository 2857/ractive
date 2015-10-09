import Hook from '../../events/Hook';
import runloop from '../../global/runloop';
import { splitKeypath } from '../../shared/keypaths';

const updateHook = new Hook( 'update' );

export default function Ractive$update ( keypath ) {
	const model = keypath ?
		this.viewmodel.joinAll( splitKeypath( keypath ) ) :
		this.viewmodel;

	const promise = runloop.start( this, true );
	model.mark();
	runloop.end();

	updateHook.fire( this, model );

	return promise;
}
