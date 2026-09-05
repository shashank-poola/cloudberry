export type CloudpediaUpdate = {
  title: string
  detail: string
  age: string
}

export type CloudpediaProject = {
  name: string
  status: "In progress" | "Planning" | "Blocked"
}

export type CloudpediaDecision = {
  title: string
  project: string
  age: string
}

export const recentUpdates: CloudpediaUpdate[] = [
  {
    title: "Authentication V2",
    detail: "Deadline moved to Sept 25",
    age: "12m ago",
  },
  {
    title: "Billing migration",
    detail: "Stripe confirmed as billing provider",
    age: "1h ago",
  },
]

export const projects: CloudpediaProject[] = [
  { name: "Authentication V2", status: "In progress" },
  { name: "Enterprise launch", status: "Planning" },
  { name: "Billing migration", status: "Blocked" },
]

export const recentDecisions: CloudpediaDecision[] = [
  {
    title: "Use Clerk for Google OAuth",
    project: "Authentication V2",
    age: "Today",
  },
  {
    title: "Move launch to October",
    project: "Enterprise launch",
    age: "Yesterday",
  },
]
