import { redirect } from "next/navigation";
export default async function LegacyPaymentReviews({searchParams}:{searchParams:Promise<{q?:string;status?:string;page?:string}>}) {
  const params=await searchParams;
  const query=new URLSearchParams();
  for(const key of ["q","status","page"] as const)if(typeof params[key]==="string")query.set(key,params[key]!);
  redirect(`/notifications${query.size?`?${query}`:""}`);
}
