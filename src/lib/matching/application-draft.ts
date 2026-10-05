type DraftInput = {
  company: string;
  role: string;
  description: string;
  fullName: string;
  resumeData: unknown;
};

export function makeRoleSpecificApplicationNote({ company, role, description, fullName, resumeData }: DraftInput): string {
  const record = asRecord(resumeData);
  const skills = Array.isArray(record.skills)
    ? record.skills.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    : [];
  const roleText = (role + " " + description).toLocaleLowerCase();
  const relevantSkills = [...new Set(skills)]
    .filter((skill) => roleText.includes(skill.toLocaleLowerCase()))
    .slice(0, 5);
  const skillSentence = relevantSkills.length > 0
    ? "My resume lists " + joinList(relevantSkills) + ", which are relevant to this role."
    : "I have included my resume for a review of the experience and skills relevant to this role.";

  return [
    "Dear " + company + " Recruiting Team,",
    "",
    "I am applying for the " + role + " position at " + company + ". " + skillSentence,
    "Please review my resume and the profile details I have provided. I would welcome the opportunity to discuss my application.",
    "",
    "Thank you,",
    fullName,
  ].join("\n");
}

function joinList(values: string[]) {
  if (values.length < 2) return values[0] ?? "";
  if (values.length === 2) return values[0] + " and " + values[1];
  return values.slice(0, -1).join(", ") + ", and " + values[values.length - 1];
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}