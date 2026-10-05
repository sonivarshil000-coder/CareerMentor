const KNOWN_SKILLS = [
  "Python", "SQL", "Excel", "Power BI", "Tableau", "Pandas", "NumPy", "scikit-learn",
  "TensorFlow", "PyTorch", "Machine Learning", "Generative AI", "Prompt Engineering",
  "Natural Language Processing", "NLP", "LLM", "RAG", "Data Analysis", "Data Visualization",
  "Statistics", "JavaScript", "TypeScript", "React", "Next.js", "Node.js", "HTML", "CSS",
  "Java", "C++", "C#", "Git", "Docker", "PostgreSQL", "MongoDB", "FastAPI", "Flask",
  "AWS", "Azure", "Figma", "PowerPoint", "Communication", "Project Management",
];

const STOP_WORDS = new Set(["a", "an", "and", "for", "in", "of", "the", "to", "with", "role", "jobs", "job"]);
const ENTRY_TERMS = /\b(intern(ship)?|entry[- ]level|junior|graduates?|new grads?|fresher|trainee|early career|associate)\b/i;
const SENIOR_TITLE = /\b(senior|sr\.?|staff|principal|lead|manager|director|head|architect|vp|chief)\b/i;

export type MatchJob = {
  title: string;
  location: string | null;
  employment: string | null;
  descriptionText: string;
};

export type MatchResume = {
  targetRole: string;
  skills: string[];
  experienceLevel: string;
};

export type MatchResult = {
  score: number;
  matchedSkills: string[];
  skillGaps: string[];
  explanation: string;
};

export function isEntryLevelJob(job: MatchJob) {
  if (SENIOR_TITLE.test(job.title)) return false;
  return ENTRY_TERMS.test(`${job.title} ${job.employment ?? ""} ${job.descriptionText.slice(0, 8_000)}`);
}

export function scoreResumeMatch(
  job: MatchJob,
  resume: MatchResume,
  preferredRoles: string[] = [],
  preferredLocations: string[] = [],
): MatchResult {
  const title = normalize(job.title);
  const roleTargets = unique([resume.targetRole, ...preferredRoles]).map(normalize).filter(Boolean);
  const titleTokens = meaningfulTokens(title);
  const roleHits = roleTargets.filter((role) => phraseMatches(title, role) || [...meaningfulTokens(role)].some((token) => titleTokens.has(token)));
  const roleFit = roleTargets.length ? roleHits.length / roleTargets.length : 0.5;

  const description = normalize(`${job.title} ${job.descriptionText}`);
  const knownRequirements = KNOWN_SKILLS.filter((skill) => phraseMatches(description, normalize(skill)));
  const resumeSkills = unique(resume.skills);
  const matchedSkills = knownRequirements.filter((required) => resumeSkills.some((skill) => sameSkill(skill, required)));
  const skillGaps = knownRequirements.filter((required) => !resumeSkills.some((skill) => sameSkill(skill, required)));
  const skillFit = knownRequirements.length
    ? matchedSkills.length / knownRequirements.length
    : resumeSkills.length > 0 ? 0.45 : 0.2;

  const location = normalize(job.location ?? "");
  const locationFit = preferredLocations.length === 0
    ? 0.6
    : preferredLocations.some((preferred) => {
      const normalized = normalize(preferred);
      return normalized === "remote" ? /\bremote\b/i.test(location) : phraseMatches(location, normalized);
    }) ? 1 : 0.15;

  const entryLevel = isEntryLevelJob(job);
  const candidateIsEarlyCareer = ["student", "entry", "junior"].includes(resume.experienceLevel.toLowerCase());
  const experienceFit = entryLevel
    ? candidateIsEarlyCareer ? 1 : 0.55
    : resume.experienceLevel.toLowerCase() === "senior" ? 1 : 0.65;

  const score = Math.max(0, Math.min(100, Math.round(
    roleFit * 35 + skillFit * 40 + locationFit * 10 + experienceFit * 15,
  )));
  const reasons = [
    roleHits.length ? `The role title aligns with ${roleHits.slice(0, 2).join(" and ")}` : "The title is a partial match for your target role",
    knownRequirements.length ? `${matchedSkills.length} of ${knownRequirements.length} listed skills appear on your resume` : "The posting does not list skills from the current matching catalog",
    preferredLocations.length ? (locationFit > 0.5 ? "the location matches your preference" : "the location differs from your preference") : "no location preference is set",
  ];

  return { score, matchedSkills, skillGaps, explanation: `${reasons.join("; ")}.` };
}

function sameSkill(left: string, right: string) {
  return normalize(left) === normalize(right);
}

function normalize(value: string) {
  return value.toLocaleLowerCase("en").replace(/[^a-z0-9+#.]+/g, " ").trim().replace(/\s+/g, " ");
}

function meaningfulTokens(value: string) {
  return new Set(value.split(" ").filter((token) => token.length > 1 && !STOP_WORDS.has(token)));
}

function phraseMatches(haystack: string, phrase: string) {
  return phrase.length > 0 && ` ${haystack} `.includes(` ${phrase} `);
}

function unique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
