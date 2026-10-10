import {Header,Footer} from "@/components/archive/chrome";
export default function Loading(){return <><Header/><main className="home-main" aria-busy="true"><p className="loading-message" role="status">正在取出档案…</p></main><Footer/></>;}
