import {render,screen,fireEvent,waitFor} from "@testing-library/react";
import {beforeEach,expect,it,vi} from "vitest";
import {RefinementModal} from "../RefinementModal";
import {curriculumFixture} from "./fixtures";
import {
  applyRoadmapRevision,
  listRoadmapJobs,
  readRoadmapProposal,
  requestRoadmapRefinement,
} from "@/lib/roadmapApi";
const state=vi.hoisted(()=>({job:null as unknown}));
vi.mock("@/lib/roadmapApi",()=>({
  listRoadmapJobs:vi.fn(),
  requestRoadmapRefinement:vi.fn(),
  readRoadmap:vi.fn(),
  readRoadmapProposal:vi.fn(),
  applyRoadmapRevision:vi.fn(),
  rejectRoadmapProposal:vi.fn(),
}));
vi.mock("@/hooks/useRoadmapJob",()=>({useRoadmapJob:()=>({job:state.job,events:[],error:null,cancel:vi.fn(),answer:vi.fn(),retry:vi.fn()})}));
beforeEach(()=>{vi.resetAllMocks();state.job=null;vi.mocked(listRoadmapJobs).mockResolvedValue([]);});
it("starts the instruction once against the current revision and can close without cancellation",async()=>{
 const view=curriculumFixture();const accepted=vi.fn();const close=vi.fn();vi.mocked(requestRoadmapRefinement).mockResolvedValue({id:"refine",operation:"refine",targetWorkspaceId:"ws",title:"Drawing",status:"queued",stage:"understand",startupReady:true,summary:"Ready",question:null,questionCount:0,error:null,result:null,lastSequence:1,createdAt:"",updatedAt:""});
 render(<RefinementModal view={view} onClose={close} onSaved={vi.fn()} onJobAccepted={accepted}/>);
 fireEvent.change(screen.getByRole("textbox",{name:"Refinement instruction"}),{target:{value:"More deliberate practice exercises"}});
 await waitFor(()=>expect(screen.getByRole("button",{name:"Generate proposal"})).toBeEnabled());
 const generate=screen.getByRole("button",{name:"Generate proposal"});fireEvent.click(generate);fireEvent.click(generate);
 await screen.findByRole("button",{name:"Continue in background"});expect(requestRoadmapRefinement).toHaveBeenCalledTimes(1);expect(requestRoadmapRefinement).toHaveBeenCalledWith("ws",{baseRevisionId:view.revisionId,instruction:"More deliberate practice exercises"},expect.any(String));expect(accepted).toHaveBeenCalledWith("refine");
 fireEvent.click(screen.getByRole("button",{name:"Continue in background"}));expect(close).toHaveBeenCalled();
});
it("recovers a saved background refinement instead of starting another one",async()=>{
 const job={id:"saved",operation:"refine" as const,targetWorkspaceId:"ws",title:"Drawing",status:"running" as const,stage:"research" as const,startupReady:true,summary:"Researching",question:null,questionCount:0,error:null,result:null,lastSequence:3,createdAt:"",updatedAt:""};state.job=job;vi.mocked(listRoadmapJobs).mockResolvedValue([job]);
 render(<RefinementModal view={curriculumFixture()} onClose={vi.fn()} onSaved={vi.fn()}/>);
 await screen.findByRole("button",{name:"Continue in background"});expect(requestRoadmapRefinement).not.toHaveBeenCalled();expect(screen.queryByRole("textbox",{name:"Refinement instruction"})).not.toBeInTheDocument();
});
it("leaves the instruction editable after a start error and retries with the same intent",async()=>{
 const view=curriculumFixture();
 vi.mocked(requestRoadmapRefinement).mockRejectedValueOnce(new Error("Provider unavailable"));
 vi.mocked(requestRoadmapRefinement).mockResolvedValueOnce({id:"refine",operation:"refine",targetWorkspaceId:"ws",title:"Drawing",status:"queued",stage:"understand",startupReady:true,summary:"Ready",question:null,questionCount:0,error:null,result:null,lastSequence:1,createdAt:"",updatedAt:""});
 render(<RefinementModal view={view} onClose={vi.fn()} onSaved={vi.fn()}/>);
 const box=await screen.findByRole("textbox",{name:"Refinement instruction"});
 fireEvent.change(box,{target:{value:"More deliberate practice exercises"}});
 fireEvent.click(screen.getByRole("button",{name:"Generate proposal"}));
 await screen.findByRole("alert");
 // The failed start is surfaced but the profile stays editable, unchanged.
 expect(screen.getByRole("textbox",{name:"Refinement instruction"})).toHaveValue("More deliberate practice exercises");
 const retry=screen.getByRole("button",{name:"Generate proposal"});expect(retry).toBeEnabled();
 fireEvent.click(retry);
 await waitFor(()=>expect(requestRoadmapRefinement).toHaveBeenCalledTimes(2));
 // The retry reuses the one idempotency key for the unchanged instruction.
 const firstKey=vi.mocked(requestRoadmapRefinement).mock.calls[0][2];
 expect(vi.mocked(requestRoadmapRefinement).mock.calls[1][2]).toBe(firstKey);
});
it("presents a completed refinement as a reviewable proposal and refreshes only on apply",async()=>{
 const view=curriculumFixture();
 const proposed={...view,revisionId:"proposal"};
 state.job={id:"refine",operation:"refine",targetWorkspaceId:"ws",title:"Drawing",status:"completed",stage:"publish",startupReady:true,summary:"Ready to review",question:null,questionCount:0,error:null,result:{kind:"proposal",workspaceId:"ws",roadmapId:"roadmap",revisionId:"proposal",proposalState:"candidate"},lastSequence:9,createdAt:"",updatedAt:""};
 vi.mocked(readRoadmapProposal).mockResolvedValue({original:view.candidate,view:proposed,baseRevisionId:view.revisionId,diff:{added:[],changed:[],removed:[],summary:"No visible changes",identityChanges:[]},affectedCompletedTopics:[],outdated:false,status:"candidate"});
 vi.mocked(applyRoadmapRevision).mockResolvedValue(proposed);
 const saved=vi.fn();const close=vi.fn();
 render(<RefinementModal view={view} resumeJobId="refine" onClose={close} onSaved={saved}/>);
 await screen.findByRole("button",{name:"Apply changes"});
 // The active revision is untouched until the learner applies.
 expect(applyRoadmapRevision).not.toHaveBeenCalled();expect(saved).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole("button",{name:"Apply changes"}));
 await waitFor(()=>expect(saved).toHaveBeenCalledWith(proposed));
 expect(close).toHaveBeenCalled();
});
