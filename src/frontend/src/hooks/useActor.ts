import { useActor as useCoreActor } from "@caffeineai/core-infrastructure";
import { createActor } from "../backend";

export function useActor() {
  return useCoreActor(createActor, {
    mockModules: import.meta.glob("../mocks/backend.{ts,tsx,js,jsx}"),
  });
}
