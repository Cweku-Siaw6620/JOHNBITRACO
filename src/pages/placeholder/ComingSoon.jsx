import { useLocation } from "react-router-dom";
export default function ComingSoon() {
  const { pathname } = useLocation();
  const title = pathname.split("/").filter(Boolean).join(" ").replace(/\b\w/g, letter => letter.toUpperCase());
  return <section style={{padding:"35px", background:"#fff",borderRadius:12}}><h1 style={{font:"bold 34px Georgia"}}>{title}</h1><p style={{color:"#777"}}>This page will be implemented next. The shared sidebar is already connected.</p></section>;
}
