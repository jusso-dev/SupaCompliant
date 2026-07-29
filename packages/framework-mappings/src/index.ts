import { allControls } from "@supacompliant/control-library";

export const FRAMEWORK_LIBRARY_VERSION = "0.1.0";

export interface FrameworkDefinition {
  id: string;
  name: string;
  version: string;
  publisher: string;
  sourceUrl: string;
  publicationId?: string;
  description: string;
  /** Never claim certification */
  disclaimer: string;
  australianFocus?: boolean;
}

export const frameworks: FrameworkDefinition[] = [
  {
    id: "ism",
    name: "Australian Government Information Security Manual",
    version: "2025",
    publisher: "Australian Signals Directorate",
    sourceUrl: "https://www.cyber.gov.au/ism",
    description:
      "Database-relevant themes: privileged access, authentication, logging, backups, patching, crypto, change management.",
    disclaimer:
      "Mappings are indicative technical contribution only — not IRAP assessment or accreditation.",
    australianFocus: true,
  },
  {
    id: "essential-eight",
    name: "Essential Eight",
    version: "2023",
    publisher: "Australian Signals Directorate",
    sourceUrl:
      "https://www.cyber.gov.au/resources-business-and-government/essential-cyber-security/essential-eight",
    description:
      "Database-adjacent strategies only. Maturity levels are not calculated from DB evidence alone.",
    disclaimer:
      "SupaCompliant never fabricates an Essential Eight maturity level from database evidence alone.",
    australianFocus: true,
  },
  {
    id: "pspf",
    name: "Protective Security Policy Framework",
    version: "2022",
    publisher: "Australian Government",
    sourceUrl: "https://www.protectivesecurity.gov.au/",
    description: "Limited INFOSEC-relevant mappings for data handling and access.",
    disclaimer: "Not a complete PSPF assessment platform.",
    australianFocus: true,
  },
  {
    id: "nist-csf",
    name: "NIST Cybersecurity Framework",
    version: "2.0",
    publisher: "NIST",
    sourceUrl: "https://www.nist.gov/cyberframework",
    description: "Function-level contribution mappings for database controls.",
    disclaimer: "Not a formal CSF assessment or certification.",
  },
  {
    id: "nist-800-53",
    name: "NIST SP 800-53",
    version: "Rev. 5",
    publisher: "NIST",
    sourceUrl:
      "https://csrc.nist.gov/publications/detail/sp/800-53/rev-5/final",
    publicationId: "NIST SP 800-53 Rev. 5",
    description: "Selected control families relevant to databases.",
    disclaimer: "Partial mapping pack — not FedRAMP authorization evidence.",
  },
  {
    id: "nist-800-171",
    name: "NIST SP 800-171",
    version: "Rev. 2",
    publisher: "NIST",
    sourceUrl:
      "https://csrc.nist.gov/publications/detail/sp/800-171/rev-2/final",
    publicationId: "NIST SP 800-171 Rev. 2",
    description: "CUI protection requirements where database evidence contributes.",
    disclaimer: "Not a complete 800-171 assessment.",
  },
  {
    id: "owasp-asvs",
    name: "OWASP ASVS",
    version: "4.0.3",
    publisher: "OWASP",
    sourceUrl:
      "https://owasp.org/www-project-application-security-verification-standard/",
    description: "Application security verification themes at the data layer.",
    disclaimer: "Not an ASVS certification.",
  },
  {
    id: "owasp-top10",
    name: "OWASP Top 10",
    version: "2021",
    publisher: "OWASP",
    sourceUrl: "https://owasp.org/Top10/",
    description: "Top 10 categories with database relevance.",
    disclaimer: "Educational mapping only.",
  },
  {
    id: "owasp-api",
    name: "OWASP API Security Top 10",
    version: "2023",
    publisher: "OWASP",
    sourceUrl: "https://owasp.org/API-Security/",
    description: "API security risks for PostgREST/Supabase surfaces.",
    disclaimer: "Educational mapping only.",
  },
  {
    id: "cis-postgresql",
    name: "CIS PostgreSQL Benchmark",
    version: "1.2.0",
    publisher: "Center for Internet Security",
    sourceUrl: "https://www.cisecurity.org/benchmark/postgresql",
    description: "PostgreSQL hardening benchmark alignment.",
    disclaimer:
      "Original CIS text not reproduced; IDs are indicative references only.",
  },
  {
    id: "cis-controls",
    name: "CIS Controls",
    version: "8.0",
    publisher: "Center for Internet Security",
    sourceUrl: "https://www.cisecurity.org/controls/v8",
    description: "Safeguards with database contribution.",
    disclaimer: "Not a full CIS Controls assessment.",
  },
  {
    id: "soc2",
    name: "SOC 2 Trust Services Criteria",
    version: "2017",
    publisher: "AICPA",
    sourceUrl: "https://www.aicpa.org/soc2",
    description: "CC/A criteria with technical database evidence contribution.",
    disclaimer: "Not a SOC 2 examination or report.",
  },
  {
    id: "iso27001",
    name: "ISO/IEC 27001 Annex A",
    version: "2022",
    publisher: "ISO",
    sourceUrl: "https://www.iso.org/standard/27001",
    description: "Annex A themes with database evidence contribution.",
    disclaimer: "Not ISO certification.",
  },
  {
    id: "pci-dss",
    name: "PCI DSS",
    version: "4.0",
    publisher: "PCI SSC",
    sourceUrl: "https://www.pcisecuritystandards.org/",
    description: "Database-related requirements where card data may exist.",
    disclaimer:
      "Does not determine PCI scope or replace a QSA assessment.",
  },
];

export function getFramework(id: string): FrameworkDefinition | undefined {
  return frameworks.find((f) => f.id === id);
}

export interface AggregatedMapping {
  frameworkId: string;
  frameworkVersion: string;
  controlIdentifier: string;
  technicalControlIds: string[];
  relationships: string[];
  rationales: string[];
  sourceUrls: string[];
}

/** Build reverse index: framework control → technical controls */
export function buildFrameworkIndex(): AggregatedMapping[] {
  const map = new Map<string, AggregatedMapping>();
  for (const control of allControls) {
    for (const m of control.mappings) {
      const key = `${m.frameworkId}::${m.frameworkVersion}::${m.controlIdentifier}`;
      const existing = map.get(key);
      if (existing) {
        existing.technicalControlIds.push(control.id);
        existing.relationships.push(m.relationship);
        existing.rationales.push(m.rationale);
        existing.sourceUrls.push(m.sourceUrl);
      } else {
        map.set(key, {
          frameworkId: m.frameworkId,
          frameworkVersion: m.frameworkVersion,
          controlIdentifier: m.controlIdentifier,
          technicalControlIds: [control.id],
          relationships: [m.relationship],
          rationales: [m.rationale],
          sourceUrls: [m.sourceUrl],
        });
      }
    }
  }
  return [...map.values()].sort((a, b) =>
    a.frameworkId === b.frameworkId
      ? a.controlIdentifier.localeCompare(b.controlIdentifier)
      : a.frameworkId.localeCompare(b.frameworkId),
  );
}

export function mappingsForFramework(frameworkId: string): AggregatedMapping[] {
  return buildFrameworkIndex().filter((m) => m.frameworkId === frameworkId);
}

export const libraryMeta = {
  version: FRAMEWORK_LIBRARY_VERSION,
  frameworkCount: frameworks.length,
};
