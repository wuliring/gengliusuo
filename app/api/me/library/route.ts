import {readerOwner,readerLibrary,readerJson,readerRouteError} from "@/lib/reader-db";

export const dynamic="force-dynamic";
export async function GET(){
 try{return readerJson(await readerLibrary(await readerOwner()));}
 catch(error){return readerRouteError(error);}
}
