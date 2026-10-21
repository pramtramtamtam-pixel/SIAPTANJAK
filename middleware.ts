import {NextRequest,NextResponse} from 'next/server';
export function middleware(req:NextRequest){
 const url=new URL(req.url),local=['localhost','127.0.0.1','[::1]'].includes(url.hostname);
 if(!local&&url.protocol!=='https:'){url.protocol='https:';return NextResponse.redirect(url,308);}
 const response=NextResponse.next();
 response.headers.set('X-Content-Type-Options','nosniff');response.headers.set('Referrer-Policy','strict-origin-when-cross-origin');
 response.headers.set('Cache-Control','no-store');
 if(url.protocol==='https:')response.headers.set('Strict-Transport-Security','max-age=31536000');
 return response;
}
export const config={matcher:['/','/api/:path*']};
