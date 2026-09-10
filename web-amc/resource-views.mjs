export function createResourceViews(){
 const publicWork=w=>{const {internalNotes,cost,internalCost,grossMargin,margin,journal,mobility,tools,contingency,calculations,estimatedTeam,personnelCost,actualPersonnelCost,actualOtherCosts,finalCost,realProfit,...safe}=w;return safe;};
 const publicQuote=q=>{const {cost,internalCost,grossMargin,margin,journal,mobility,tools,contingency,calculations,internalNotes,estimatedTeam,personnelCost,...safe}=q;return safe;};
 const employeeWork=w=>{const safe=publicWork(w);delete safe.budget;delete safe.payments;delete safe.baseBudget;delete safe.userId;return safe;};
 return {publicWork,publicQuote,employeeWork};
}
