import { createContext } from "react";
import type { SectionProps } from "./ui";

export const SectionRevealContext =
  createContext<SectionProps["onReveal"]>(undefined);
