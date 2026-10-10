import {requireReaderOwner,clearReaderHistory,readReaderEmptyBody,readerJson,readerRouteError} from "@/lib/reader-db";

export async function DELETE(req:Request){
 try{
  const owner=await requireReaderOwner(req);
  await readReaderEmptyBody(req);
  return readerJson({library:await clearReaderHistory(owner)});
 }catch(error){return readerRouteError(error);}
}
