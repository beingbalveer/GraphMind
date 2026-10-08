import {render,screen,fireEvent,waitFor} from "@testing-library/react";
import {beforeEach,expect,it,vi} from "vitest";
import {RefinementModal} from "../RefinementModal";
import {curriculumFixture} from "./fixtures";
import {listRoadmapJobs,requestRoadmapRefinement} from "@/lib/roadmapApi";
const state=vi.hoisted(()=>({job:null as unknown}));
vi.mock("@/lib/roadmapApi",()=>({listRoadmapJobs:vi.fn(),requestRoadmapRefinement:vi.fn(),readRoadmap:vi.fn()}));
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
