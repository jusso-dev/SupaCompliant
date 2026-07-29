# Limitations

1. **Not certification.** Passing technical controls is not IRAP, SOC 2, ISO, PCI, or Essential Eight certification.
2. **Essential Eight maturity** is never calculated from database evidence alone.
3. **Manual evidence** is required for backups, MFA policy, key rotation, log export, access reviews.
4. **Hostile target assumption** — malicious databases may return deceptive catalogue data; cross-check critical claims.
5. **Capability gaps** surface as `unknown` / `not_assessed`, reducing coverage — not silently skipped as pass.
6. **Sensitive sampling** is metadata-first; full-row secret scanning is out of scope by design.
7. **Demo mode** UI uses seeded data; live Auth/worker require deployment configuration.
