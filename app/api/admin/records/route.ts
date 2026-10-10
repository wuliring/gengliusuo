import {z} from "zod";
import {recordSchema} from "@/lib/records";
import {saveRecord} from "@/lib/archive-db";
import {requireEditor,requireSameOrigin,boundedJson,routeError} from "@/lib/admin-auth";
export async function POST(req:Request){try{await requireEditor();requireSameOrigin(req);const input=z.object({record:recordSchema,expectedRevision:z.null()}).safeParse(await boundedJson(req));if(!input.success)return Response.json({error:[...new Set(input.error.issues.map(v=>v.message))].join("\n")},{status:400});const record=await saveRecord(input.data.record,null);return Response.json({record},{status:201,headers:{"Cache-Control":"no-store"}});}catch(e){return routeError(e);}}
