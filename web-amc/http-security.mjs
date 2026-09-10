export function applyHttpSecurity({res,origin,pathname}){
 const estimatorPage=pathname==='/presupuestos';
 if(origin.startsWith('https:'))res.setHeader('Strict-Transport-Security','max-age=31536000; includeSubDomains');
 res.setHeader('Cache-Control','no-store');
 res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('Referrer-Policy','same-origin');
 res.setHeader('X-Frame-Options','SAMEORIGIN');
 res.setHeader('Cross-Origin-Opener-Policy','same-origin-allow-popups');
 res.setHeader('Cross-Origin-Resource-Policy','same-origin');
 res.setHeader('Permissions-Policy','camera=(self), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=()');
 res.setHeader('Content-Security-Policy',estimatorPage?"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'self'; frame-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; worker-src 'self'; manifest-src 'self'":"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'self'; frame-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; worker-src 'self'; manifest-src 'self'");
}
