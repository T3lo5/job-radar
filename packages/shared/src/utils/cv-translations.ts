/**
 * Mapeamento de cargos em português para equivalentes em inglês,
 * seguindo o padrão de mercado internacional.
 *
 * Baseado no guia ATS: "Analista de Sistemas Pleno" vira "Software Developer"
 * ou "Software Engineer (Mid-level)". Evite siglas internas da empresa.
 */
export const JOB_TITLE_MAP: Record<string, string> = {
  'analista de sistemas': 'Software Developer',
  'analista de sistemas pleno': 'Software Engineer (Mid-level)',
  'analista de sistemas júnior': 'Junior Software Developer',
  'analista de sistemas sênior': 'Senior Software Developer',
  'analista de sistemas estagiário': 'Software Development Intern',
  'analista de sistemas supervisor': 'Software Development Lead',
  'desenvolvedor de software': 'Software Developer',
  'desenvolvedor de software pleno': 'Software Engineer (Mid-level)',
  'desenvolvedor de software júnior': 'Junior Software Developer',
  'desenvolvedor de software sênior': 'Senior Software Developer',
  'desenvolvedor full stack': 'Full Stack Developer',
  'desenvolvedor front end': 'Frontend Developer',
  'desenvolvedor backend': 'Backend Developer',
  'desenvolvedor fullstack': 'Full Stack Developer',
  'desenvolvedor mobile': 'Mobile Developer',
  'desenvolvedor iOS': 'iOS Developer',
  'desenvolvedor Android': 'Android Developer',
  'engenheiro de software': 'Software Engineer',
  estagiário: 'Intern',
  'estagiário de desenvolvimento': 'Software Development Intern',
  'product manager': 'Product Manager',
  'project manager': 'Project Manager',
  'data analyst': 'Data Analyst',
  'data scientist': 'Data Scientist',
  'devops engineer': 'DevOps Engineer',
  'qa engineer': 'QA Engineer',
  'tech lead': 'Tech Lead',
  'arquiteto de software': 'Software Architect',
  'administrador de banco de dados': 'Database Administrator',
  dba: 'Database Administrator',
};

/**
 * Mapeamento de nomes de cursos para a terminologia internacional.
 * Ex: "Bacharelado em Sistemas de Informação" → "Bachelor's Degree in Information Systems"
 */
export const DEGREE_MAP: Record<string, string> = {
  'bacharelado em sistemas de informação': "Bachelor's Degree in Information Systems",
  'bacharelado em ciência da computação': "Bachelor's Degree in Computer Science",
  'bacharelado em engenharia de software': "Bachelor's Degree in Software Engineering",
  'bacharelado em engenharia': "Bachelor's Degree in Engineering",
  'licenciatura em': "Bachelor's Degree in",
  'tecnólogo em': 'Associate Degree in',
  'cursos de extensão': 'Extension Course',
  'especialização em': 'Specialization in',
  'mba em': 'MBA in',
  'mestrado em': "Master's Degree in",
  'doutorado em': 'PhD in',
  'tec. em': 'Technical Course in',
};

export function translateJobTitle(title: string): string {
  const normalized = title.trim().toLowerCase();
  return JOB_TITLE_MAP[normalized] ?? title;
}

export function translateDegree(degree: string): string {
  const normalized = degree.trim().toLowerCase();
  for (const [key, value] of Object.entries(DEGREE_MAP)) {
    if (normalized.includes(key)) {
      return normalized.replace(key, value);
    }
  }
  return degree;
}
