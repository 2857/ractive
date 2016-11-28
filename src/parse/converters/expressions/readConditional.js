import { CONDITIONAL } from '../../../config/types';
import readLogicalOr from './readLogicalOr';
import { expectedExpression } from './shared/errors';
import readExpression from '../readExpression';

// The conditional operator is the lowest precedence operator, so we start here
export default function getConditional ( parser ) {
	const expression = readLogicalOr( parser );
	if ( !expression ) {
		return null;
	}

	const start = parser.pos;

	parser._allowWhitespace();

	if ( !parser._matchString( '?' ) ) {
		parser.pos = start;
		return expression;
	}

	parser._allowWhitespace();

	const ifTrue = readExpression( parser );
	if ( !ifTrue ) {
		parser.error( expectedExpression );
	}

	parser._allowWhitespace();

	if ( !parser._matchString( ':' ) ) {
		parser.error( 'Expected ":"' );
	}

	parser._allowWhitespace();

	const ifFalse = readExpression( parser );
	if ( !ifFalse ) {
		parser.error( expectedExpression );
	}

	return {
		t: CONDITIONAL,
		o: [ expression, ifTrue, ifFalse ]
	};
}
