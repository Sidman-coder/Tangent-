export interface Website {
  name: string
  url: string
  icon: string
  description: string
}

interface ResourceClickResource {
  label: string
  url: string
}

interface ResourceClickTask {
  id?: string
  title?: string
  planId?: string | null
}

export function handleResourceClick(resource: ResourceClickResource, task: ResourceClickTask): void {
  window.open(resource.url, "_blank", "noopener,noreferrer")
}

export function getSuggestedWebsites(title: string, notes: string): Website[] {
  const text = (title + " " + (notes || "")).toLowerCase()
  const suggestions: Website[] = []

  const youtubeQuery = generateYoutubeQuery(title, notes)
  suggestions.push({
    name: "YouTube",
    url: `https://www.youtube.com/results?search_query=${encodeURIComponent(youtubeQuery)}`,
    icon: "▶",
    description: `Search: "${youtubeQuery}"`,
  })

  const khanQuery = generateKhanQuery(title, notes)
  if (isAcademicTask(text)) {
    suggestions.push({
      name: "Khan Academy",
      url: `https://www.khanacademy.org/search?page_search_query=${encodeURIComponent(khanQuery)}`,
      icon: "📚",
      description: `Search: "${khanQuery}"`,
    })
  }

  if (/spanish|french|language|duolingo|vocab|vocabulary|german|japanese|chinese|italian|korean|portuguese/.test(text)) {
    suggestions.push({
      name: "Duolingo",
      url: "https://www.duolingo.com",
      icon: "🦉",
      description: "Continue your language lesson",
    })
  }

  if (/fulton|canvas|portal|submit|assignment|due|school|class period|teacher|syllabus/.test(text)) {
    suggestions.push({
      name: "Fulton County Schools",
      url: "https://www.fultonschools.org",
      icon: "🏫",
      description: "Access school portal",
    })
  }

  suggestions.push({
    name: "Google Calendar",
    url: "https://calendar.google.com",
    icon: "📅",
    description: "View your calendar",
  })

  return suggestions
}

function generateYoutubeQuery(title: string, notes: string): string {
  const text = (title + " " + (notes || "")).toLowerCase()

  if (text.includes("derivative") || text.includes("derivatives")) return "calculus derivatives tutorial"
  if (text.includes("integral") || text.includes("integration")) return "calculus integration tutorial"
  if (text.includes("limits")) return "calculus limits explained"
  if (text.includes("chain rule")) return "chain rule calculus tutorial"
  if (text.includes("product rule")) return "product rule calculus"
  if (text.includes("quotient rule")) return "quotient rule calculus"
  if (text.includes("related rates")) return "related rates calculus"
  if (text.includes("optimization")) return "calculus optimization problems"
  if (text.includes("riemann sum")) return "riemann sum calculus"
  if (text.includes("fundamental theorem")) return "fundamental theorem of calculus"
  if (text.includes("u substitution")) return "u substitution calculus"
  if (text.includes("implicit differentiation")) return "implicit differentiation tutorial"
  if (text.includes("mean value theorem")) return "mean value theorem calculus"
  if (text.includes("l hopital") || text.includes("lhopital")) return "lhopital rule calculus"
  if (text.includes("series") && text.includes("calc")) return "calculus series convergence"
  if (text.includes("taylor series")) return "taylor series calculus"
  if (text.includes("maclaurin")) return "maclaurin series tutorial"
  if (text.includes("differential equation")) return "differential equations tutorial"
  if (text.includes("linear algebra")) return "linear algebra tutorial"
  if (text.includes("matrix") || text.includes("matrices")) return "matrix operations linear algebra"
  if (text.includes("eigenvalue")) return "eigenvalues and eigenvectors"
  if (text.includes("vector")) return "vectors math tutorial"
  if (text.includes("statistics") || text.includes("stats")) return "statistics tutorial"
  if (text.includes("probability")) return "probability tutorial"
  if (text.includes("normal distribution")) return "normal distribution statistics"
  if (text.includes("hypothesis test")) return "hypothesis testing statistics"
  if (text.includes("regression")) return "linear regression statistics"
  if (text.includes("algebra")) return "algebra tutorial"
  if (text.includes("quadratic")) return "quadratic equations tutorial"
  if (text.includes("trigonometry") || text.includes("trig")) return "trigonometry tutorial"
  if (text.includes("geometry")) return "geometry tutorial"
  if (text.includes("newton") && text.includes("law")) return "newtons laws of motion"
  if (text.includes("kinematics")) return "kinematics physics tutorial"
  if (text.includes("momentum")) return "momentum physics"
  if (text.includes("energy") && text.includes("physics")) return "energy conservation physics"
  if (text.includes("electricity") || text.includes("circuit")) return "electricity circuits physics"
  if (text.includes("magnetism")) return "magnetism physics tutorial"
  if (text.includes("wave") && text.includes("physics")) return "waves physics tutorial"
  if (text.includes("thermodynamics")) return "thermodynamics tutorial"
  if (text.includes("physics")) return "physics tutorial"
  if (text.includes("stoichiometry")) return "stoichiometry tutorial chemistry"
  if (text.includes("mole") && text.includes("chem")) return "mole concept chemistry"
  if (text.includes("periodic table")) return "periodic table explained"
  if (text.includes("chemical bond")) return "chemical bonding tutorial"
  if (text.includes("acid") && text.includes("base")) return "acids and bases chemistry"
  if (text.includes("oxidation") || text.includes("redox")) return "redox reactions chemistry"
  if (text.includes("organic chemistry")) return "organic chemistry tutorial"
  if (text.includes("chemistry") || text.includes("chem")) return "chemistry tutorial"
  if (text.includes("cell") && text.includes("bio")) return "cell biology tutorial"
  if (text.includes("dna") || text.includes("genetics")) return "genetics DNA tutorial"
  if (text.includes("evolution")) return "evolution biology"
  if (text.includes("photosynthesis")) return "photosynthesis biology"
  if (text.includes("mitosis") || text.includes("meiosis")) return "mitosis meiosis cell division"
  if (text.includes("biology") || text.includes("bio")) return "biology tutorial"
  if (text.includes("history")) return title + " history explained"
  if (text.includes("essay") || text.includes("writing")) return "how to write a strong essay"
  if (text.includes("spanish")) return "spanish lesson for beginners"
  if (text.includes("french")) return "french lesson tutorial"
  if (text.includes("javascript")) return "javascript tutorial"
  if (text.includes("python")) return "python programming tutorial"
  if (text.includes("programming") || text.includes("coding")) return "programming tutorial for beginners"

  return title + " tutorial explained"
}

function generateKhanQuery(title: string, notes: string): string {
  const text = (title + " " + (notes || "")).toLowerCase()

  if (text.includes("derivative") || text.includes("derivatives")) return "derivatives calculus"
  if (text.includes("integral") || text.includes("integration")) return "integrals calculus"
  if (text.includes("limits")) return "limits calculus"
  if (text.includes("chain rule")) return "chain rule"
  if (text.includes("related rates")) return "related rates"
  if (text.includes("optimization")) return "optimization calculus"
  if (text.includes("riemann")) return "riemann sums"
  if (text.includes("fundamental theorem")) return "fundamental theorem calculus"
  if (text.includes("u substitution")) return "u substitution"
  if (text.includes("implicit")) return "implicit differentiation"
  if (text.includes("series")) return "series calculus"
  if (text.includes("taylor")) return "taylor series"
  if (text.includes("differential equation")) return "differential equations"
  if (text.includes("linear algebra")) return "linear algebra"
  if (text.includes("matrix")) return "matrices"
  if (text.includes("statistics") || text.includes("stats")) return "statistics probability"
  if (text.includes("probability")) return "probability"
  if (text.includes("quadratic")) return "quadratic equations"
  if (text.includes("trigonometry") || text.includes("trig")) return "trigonometry"
  if (text.includes("algebra")) return "algebra"
  if (text.includes("geometry")) return "geometry"
  if (text.includes("kinematics")) return "kinematics"
  if (text.includes("newton")) return "newtons laws"
  if (text.includes("physics")) return "physics"
  if (text.includes("stoichiometry")) return "stoichiometry"
  if (text.includes("chemistry")) return "chemistry"
  if (text.includes("genetics")) return "genetics"
  if (text.includes("biology")) return "biology"
  if (text.includes("history")) return "world history"
  if (text.includes("economics")) return "economics"
  if (text.includes("programming")) return "computer science"

  return title
}

function isAcademicTask(text: string): boolean {
  return !!(text.match(/math|calc|algebra|geometry|trig|physics|chemistry|biology|history|economics|statistics|science|study|homework|learn|review|practice|exam|test|quiz|derivative|integral|equation|theorem|proof|formula/))
}
