import {z} from "zod";
import {getPublishedByIds} from "@/lib/archive-db";
import {boundedJson,requireSameOrigin,routeError} from "@/lib/admin-auth";
export async function POST(request:Request){try{requireSameOrigin(request);const parsed=z.object({ids:z.array(z.string().min(2).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)).max(500)}).strict().safeParse(await boundedJson(request,60000));if(!parsed.success)return Response.json({error:"档案地址格式不正确，每次最多查询 500 份。"},{status:400,headers:{"Cache-Control":"no-store"}});return Response.json({records:await getPublishedByIds(parsed.data.ids)},{headers:{"Cache-Control":"no-store"}});}catch(error){return routeError(error);}}
