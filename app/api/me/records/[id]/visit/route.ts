import {readerIdSchema} from "@/lib/reader-types";
import {requireReaderOwner,visitReaderEntry,readReaderEmptyBody,readerJson,readerRouteError} from "@/lib/reader-db";

export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){
 try{
  const owner=await requireReaderOwner(req);
  const id=readerIdSchema.parse((await params).id);
  await readReaderEmptyBody(req);
  return readerJson({entry:await visitReaderEntry(owner,id)});
 }catch(error){return readerRouteError(error);}
}
