export function reconcileNativeNotifications(state,native=globalThis.window?.AMCNative){
 const ids=[...new Set((Array.isArray(state?.notices)?state.notices:[]).filter(notice=>notice&&!notice.read&&notice.id).map(notice=>String(notice.id)))];
 try{native?.reconcileNotifications?.(JSON.stringify(ids));}catch{}
 return ids;
}
