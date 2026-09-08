import { ProjectShell } from "@/components/project/ProjectShell";

export default async function ProjectLayout({
  children,
  params,
}: LayoutProps<"/projekt/[id]">) {
  const { id } = await params;
  return <ProjectShell projectId={id}>{children}</ProjectShell>;
}
