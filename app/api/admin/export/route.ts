import {exportRecords} from "@/lib/archive-db";
import {requireEditor,routeError} from "@/lib/admin-auth";
export async function GET(){try{await requireEditor();return Response.json(await exportRecords(),{headers:{"Cache-Control":"no-store","Content-Disposition":"attachment; filename=gengliusuo-backup.json"}});}catch(e){return routeError(e);}}
