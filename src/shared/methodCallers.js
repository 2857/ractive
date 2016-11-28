export function bind               ( x ) { x.bind(); }
export function cancel             ( x ) { x.cancel(); }
export function destroyed          ( x ) { x.destroyed(); }
export function handleChange       ( x ) { x._handleChange(); }
export function mark               ( x ) { x.mark(); }
export function marked             ( x ) { x.marked(); }
export function markedAll          ( x ) { x.markedAll(); }
export function notifiedUpstream   ( x ) { x.notifiedUpstream(); }
export function render             ( x ) { x.render(); }
export function shuffled           ( x ) { x.shuffled(); }
export function teardown           ( x ) { x.teardown(); }
export function unbind             ( x ) { x.unbind(); }
export function unrender           ( x ) { x.unrender(); }
export function unrenderAndDestroy ( x ) { x.unrender( true ); }
export function update             ( x ) { x.update(); }
export function toString           ( x ) { return x.toString(); }
export function toEscapedString    ( x ) { return x.toString( true ); }
