import { getRepos } from "@/lib/github";
import { en } from "@/lib/i18n";
import { personalData, plainName } from "@/lib/personal";

export const dynamic = "force-static";

export const GET = async (): Promise<Response> => {
  const repos = await getRepos(personalData.githubHandle);
  const body = [
    `# ${personalData.name}`,
    "",
    `> ${en.llms.about
      .replace("{city}", () => personalData.city)
      .replace("{country}", () => personalData.country)}`,
    "",
    `${en.llms.detail} ${en.llms.alsoWritten.replace("{name}", () => plainName)}`,
    "",
    `## ${en.llms.topics}`,
    "",
    personalData.knowsAbout.join(", "),
    "",
    `## ${en.llms.projects}`,
    "",
    ...repos.map(
      (repo) => `- [${repo.name}](${repo.url}): ${repo.description}`
    ),
    "",
    `## ${en.llms.links}`,
    "",
    `- [${en.llms.website}](${personalData.website}/)`,
    `- [${en.llms.resume}](${personalData.website}/resume.pdf)`,
    `- [${en.llms.github}](${personalData.github})`,
    `- [${en.llms.linkedin}](${personalData.linkedin})`,
    `- [${en.llms.email}](mailto:${personalData.email})`,
    "",
  ].join("\n");
  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
