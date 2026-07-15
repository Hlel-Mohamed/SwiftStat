# Attribution & Data Licensing

SwiftStat bundles rules data derived from the Dungeons & Dragons **System Reference
Document (SRD)**, published by Wizards of the Coast.

## SRD content — CC-BY-4.0

The card data in `public/data/srd-2014.json` and `public/data/srd-2024.json` is derived
from:

- **System Reference Document 5.1** ("SRD 5.1"), © Wizards of the Coast LLC.
- **System Reference Document 5.2.1** ("SRD 5.2.1"), © Wizards of the Coast LLC.

Both are licensed under the **Creative Commons Attribution 4.0 International License**
(CC-BY-4.0): https://creativecommons.org/licenses/by/4.0/legalcode

Required attribution, per that license:

> This work includes material from the System Reference Document 5.1 ("SRD 5.1") and the
> System Reference Document 5.2.1 ("SRD 5.2.1") by Wizards of the Coast LLC, available at
> https://dnd.wizards.com/resources/systems-reference-document. The SRD 5.1 and SRD 5.2.1
> are licensed under the Creative Commons Attribution 4.0 International License, available
> at https://creativecommons.org/licenses/by/4.0/legalcode.

The SRD data was structured with the help of the community project
[5e-bits/5e-database](https://github.com/5e-bits/5e-database) (MIT-licensed tooling; the
data it carries is the CC-BY SRD).

## "5.2.1 change" notes

The `type: "change"` cards summarizing differences between SRD 5.1 and 5.2.1 are written
in SwiftStat's own words (see `scripts/srd-2024-extras.mjs`). They paraphrase factual
rule changes and do not reproduce Wizards of the Coast's prose.

## Not affiliated

SwiftStat is unofficial fan content and is **not affiliated with, endorsed, sponsored, or
approved by Wizards of the Coast**. Dungeons & Dragons and D&D are trademarks of Wizards
of the Coast LLC.

## Source code

SwiftStat's source code is licensed under the MIT License — see `LICENSE`.
