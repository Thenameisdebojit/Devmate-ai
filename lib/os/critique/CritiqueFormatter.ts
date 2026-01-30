/**
 * PHASE F′-7: Critique Formatter
 * 
 * Converts critique reports into user-friendly messages.
 */

import type { CritiqueReport, Finding } from './CritiqueEngine'

/**
 * Format critique report as ASSISTANT_MESSAGE content
 */
export function formatCritiqueReportAsMessage(report: CritiqueReport): string {
  const { findings, summary, confidence } = report

  if (findings.length === 0) {
    return `✅ **Evolution Review Complete**\n\n${summary}\n\nThe changes look good! No issues detected.`
  }

  // Build message
  const parts: string[] = []

  parts.push('🔍 **Evolution Review**\n')
  parts.push(`${summary}\n`)

  // Group findings by severity
  const highSeverity = findings.filter(f => f.severity === 'high')
  const mediumSeverity = findings.filter(f => f.severity === 'medium')
  const lowSeverity = findings.filter(f => f.severity === 'low')

  // Add high severity findings first
  if (highSeverity.length > 0) {
    parts.push('**🔴 High Priority Issues:**')
    highSeverity.forEach((finding, index) => {
      parts.push(`${index + 1}. **${finding.description}**`)
      if (finding.evidence) {
        parts.push(`   *${finding.evidence}*`)
      }
      parts.push(`   → Suggested fix: ${finding.suggestedFix.description}`)
    })
    parts.push('')
  }

  // Add medium severity findings
  if (mediumSeverity.length > 0) {
    parts.push('**🟡 Medium Priority Issues:**')
    mediumSeverity.forEach((finding, index) => {
      parts.push(`${index + 1}. **${finding.description}**`)
      if (finding.evidence) {
        parts.push(`   *${finding.evidence}*`)
      }
      parts.push(`   → Suggested fix: ${finding.suggestedFix.description}`)
    })
    parts.push('')
  }

  // Add low severity findings
  if (lowSeverity.length > 0) {
    parts.push('**🟢 Low Priority Issues:**')
    lowSeverity.forEach((finding, index) => {
      parts.push(`${index + 1}. **${finding.description}**`)
      if (finding.evidence) {
        parts.push(`   *${finding.evidence}*`)
      }
      parts.push(`   → Suggested fix: ${finding.suggestedFix.description}`)
    })
    parts.push('')
  }

  // Add confidence indicator
  if (confidence < 0.6) {
    parts.push('*Note: Confidence in these findings is moderate. You may want to review manually.*')
  }

  parts.push('\n**Would you like me to fix any of these issues?**')

  return parts.join('\n')
}

/**
 * Format critique report metadata for ASSISTANT_MESSAGE
 */
export function formatCritiqueReportMetadata(report: CritiqueReport): Record<string, any> {
  return {
    type: 'critique_report',
    evolutionId: report.evolutionId,
    goalId: report.goalId,
    findingCount: report.findings.length,
    confidence: report.confidence,
    findings: report.findings.map(finding => ({
      type: finding.type,
      description: finding.description,
      severity: finding.severity,
      suggestedFix: {
        id: finding.suggestedFix.id,
        description: finding.suggestedFix.description,
        intentType: finding.suggestedFix.intentType,
        estimatedImpact: finding.suggestedFix.estimatedImpact,
      },
      evidence: finding.evidence,
    })),
  }
}
