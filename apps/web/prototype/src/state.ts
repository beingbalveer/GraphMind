import { curriculum } from "./curriculum";

export type Message = {
  id: number;
  role: "learner" | "tutor";
  text: string;
  quote?: string;
};
export type State = {
  view: "home" | "roadmap" | "lesson" | "library" | "conversation";
  lesson: number;
  completed: string[];
  title: string;
  conversations: Record<string, Message[]>;
  quote?: string;
};
export type Action =
  | { type: "view"; view: State["view"] }
  | { type: "lesson"; index: number }
  | { type: "conversation-topic"; index: number }
  | { type: "complete" }
  | { type: "title"; value: string }
  | { type: "quote"; value?: string }
  | { type: "message"; topicId: string; message: Message }
  | { type: "reset" };
export const initial: State = {
  view: "home",
  lesson: 0,
  completed: [],
  title: "Python for backend developers",
  conversations: {},
};
export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "view":
      return { ...state, view: action.view };
    case "lesson":
      return {
        ...state,
        lesson: action.index,
        view: "lesson",
        quote: action.index === state.lesson ? state.quote : undefined,
      };
    case "conversation-topic":
      return {
        ...state,
        lesson: action.index,
        view: "conversation",
        quote: undefined,
      };
    case "complete":
      return {
        ...state,
        completed: state.completed.includes(curriculum[state.lesson].id)
          ? state.completed
          : [...state.completed, curriculum[state.lesson].id],
      };
    case "title":
      return { ...state, title: action.value };
    case "quote":
      return { ...state, quote: action.value };
    case "message": {
      const key = action.topicId;
      return {
        ...state,
        conversations: {
          ...state.conversations,
          [key]: [...(state.conversations[key] ?? []), action.message],
        },
      };
    }
    case "reset":
      return initial;
  }
}
