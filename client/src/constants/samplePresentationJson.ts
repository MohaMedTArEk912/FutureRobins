import type { MotionPresentation } from '../types';

export type SamplePresentationTemplate = Omit<MotionPresentation, 'presentationId'> & {
    _aiPrompt?: Record<string, unknown>;
};

export const SAMPLE_FULL_PRESENTATION: SamplePresentationTemplate = {
    _aiPrompt: {
        version: '2.0',
        targetPlatform: 'Future Robins — Interactive Teaching Board',
        templateType: 'motion-presentation',
        howToUse: [
            '1. Attach or paste your lecture slides (PDF/PPTX), markdown notes, code examples, or target topic along with this JSON.',
            '2. Instruct the AI: "Follow _aiPrompt strictly to transform my material into an interactive Motion Presentation JSON deck."',
            '3. Upload the returned JSON (without _aiPrompt) in Presentations -> Upload Slide File & Save or Visual Board -> Upload JSON.'
        ],
        prompt:
            "You are an expert Curriculum Architect, Visual Teaching Board Designer, and strict JSON compiler for Future Robins. Transform the attached slides, PDF, notes, or topic into an engaging, visually scannable interactive Motion Presentation deck in strict JSON format.\n\nPEDAGOGICAL & SLIDE PACING RULES:\n- Ground every slide strictly in the attached material's real concepts, code snippets, workflows, comparisons, and pitfalls.\n- Target 7-12 focused slides (1 clear idea per slide, never walls of text):\n  1) Open with a 'hero' slide introducing the session scope and 3 concrete outcomes.\n  2) Include at least 1-2 interactive 'wireframe' slides using visualBlock ('page-structure', 'split-cards', or 'footer-anatomy') adapted to the lesson domain (architecture pipelines, UI layouts, system comparisons, or 3-column breakdowns) so teachers can click sections live.\n  3) Include 'code' slides pairing a clean 'codeSnippet' alongside 2-4 crisp bullet takeaways.\n  4) Place a live 'checkup' poll slide every 3-4 teaching slides to test understanding before moving on, with 4 balanced options, 0-based 'correctAnswer', and a sharp 'explanation'.\n  5) End with a 'summary' or 'homework' wrap-up slide reinforcing key takeaways.\n- Add actionable 'speakerNotes' on every slide guiding what the teacher should emphasize or click.\n\nCRITICAL UI & TEXT RENDERING RULES (PresentationModePlayer):\n- All text fields ('title', 'subtitle', 'body', 'bullets', 'callout', 'speakerNotes', 'checkupQuestion.*') render as plain UI text—NEVER use raw Markdown (**bold**, *italic*, ### headings, ```code blocks```, or `inline backticks`).\n- Put all source code strictly inside 'codeSnippet.code' or 'visualBlock.sections[].code' using escaped \\n newlines.\n- Keep slide titles concise (<= 8 words), body <= 2 sentences, bullets 3-5 items max (<= 14 words per bullet), and callouts 1 crisp takeaway sentence so cards look clean on both Neo-Bento and Noir Dark boards without clipping.\n\nSTRICT JSON OUTPUT:\n- Return ONLY valid raw JSON matching the presentation contract below. Omit '_aiPrompt' in your final output.",
        strictJsonContract: {
            rootObject: {
                title: 'string (required presentation deck title)',
                description: 'string (concise 1-2 sentence session summary)',
                theme: "enum: 'dark-tech' | 'bento' | 'editorial' | 'neon'",
                sourceFormat: "'json'",
                slides: 'MotionSlide[] (ordered slides; omit _aiPrompt)'
            },
            MotionSlide: {
                id: "string (unique snake_case ID, e.g. 'slide_1_intro')",
                order: 'number (0-based integer index: 0, 1, 2, ...)',
                layout: "enum: 'hero' | 'bullets' | 'split' | 'code' | 'comparison' | 'timeline' | 'wireframe' | 'live-preview' | 'checkup' | 'homework' | 'summary'",
                motion: "enum: 'fade-up' | 'slide-left' | 'zoom-in' | 'stagger' | 'pop' | 'flip'",
                title: 'string (required, plain text <= 8 words)',
                subtitle: 'string (optional module/phase badge line)',
                body: 'string (optional 1-2 short framing sentences)',
                bullets: 'string[] (optional 3-5 crisp takeaways; <= 14 words each)',
                codeSnippet: '{ language: string, code: string } (optional; displays dark syntax card alongside bullets)',
                visualBlock: 'PageStructureBlock | SplitCardsBlock | FooterAnatomyBlock (optional clickable board widget)',
                callout: 'string (optional key takeaway or pro tip banner)',
                speakerNotes: 'string (teacher guidance & live interaction prompts)',
                durationSeconds: 'number (suggested teaching seconds, e.g. 45-90)',
                checkupQuestion: "{ question: string, options: string[4], correctAnswer: number, explanation: string, points: number } (required when layout === 'checkup')"
            },
            visualBlockSchemas: {
                pageStructure: "{ kind: 'page-structure', sections: [{ id: string, label: string, tag?: string, description: string, highlight?: boolean, code?: string }] }",
                splitCards: "{ kind: 'split-cards', leftCard: { tag?: string, title: string, body: string }, rightCards: [{ title: string, subtitle?: string, badge?: string }] }",
                footerAnatomy: "{ kind: 'footer-anatomy', topNav: { brand: string, links: string[] }, columns: [{ title: string, items: string[] }] }"
            }
        }
    },
    title: 'Interactive Web Architecture & Semantics',
    description: 'Complete Teaching Board template showcasing Hero, all 3 clickable Blueprint visualBlocks, Code Lab, Side-by-Side Comparison, Live Check-Up Polls, and Homework Wrap-Up slides.',
    theme: 'bento',
    sourceFormat: 'json',
    slides: [
        {
            id: 'sample_slide_1',
            order: 0,
            layout: 'hero',
            motion: 'zoom-in',
            title: 'Modern Page Architecture & Layout Systems',
            subtitle: 'Session 01 • Interactive Teaching Board',
            body: 'Scan real interfaces into reusable structural boxes, combine Flexbox with CSS Grid, and verify accessibility interactively.',
            bullets: ['Semantic Page Blueprint', '50/50 Grid vs Flex Stacks', 'Live Check-Up Polls'],
            callout: 'Teaching Board: Click visual blueprint cards to highlight elements live for your students.',
            speakerNotes: 'Welcome students and outline the 3 core learning milestones for today.',
            durationSeconds: 45
        },
        {
            id: 'sample_slide_2',
            order: 1,
            layout: 'wireframe',
            motion: 'fade-up',
            title: '1. Semantic Document Blueprint',
            subtitle: 'Click each section to inspect its HTML landmark',
            body: 'Before writing CSS, break the interface into semantic regions. Click any block on the left to inspect its markup on the right:',
            visualBlock: {
                kind: 'page-structure',
                sections: [
                    {
                        id: 'sec_header',
                        label: 'Header & Primary Navigation',
                        tag: '<header>',
                        description: 'Houses brand identity and top-level navigation links for fast site orientation.',
                        code: '<header class="site-header">\n  <a class="brand" href="/">QuizLab</a>\n  <nav aria-label="Primary">Links...</nav>\n</header>'
                    },
                    {
                        id: 'sec_main',
                        label: 'Main Interactive Workspace',
                        tag: '<main>',
                        description: 'Wraps the dominant unique content of the page so screen readers jump directly here.',
                        highlight: true,
                        code: '<main id="content">\n  <section class="features">...</section>\n</main>'
                    },
                    {
                        id: 'sec_footer',
                        label: 'Structured Info Footer',
                        tag: '<footer>',
                        description: 'Contains secondary navigation, contact info, campus links, and copyright metadata.',
                        code: '<footer class="site-footer">\n  <div class="cols-3">...</div>\n</footer>'
                    }
                ]
            },
            callout: 'One <main> landmark per page keeps keyboard navigation predictable and screen-reader friendly.',
            speakerNotes: 'Click Header -> Main -> Footer slowly while students trace the DOM outline.',
            durationSeconds: 75
        },
        {
            id: 'sample_slide_3',
            order: 2,
            layout: 'wireframe',
            motion: 'slide-left',
            title: '2. Asymmetric Bento Split Pattern',
            subtitle: 'Combining 2-column CSS Grid with Flex stacks',
            body: 'Pair CSS Grid for macro two-half alignment with vertical Flexbox when one half contains stacked feature cards:',
            visualBlock: {
                kind: 'split-cards',
                leftCard: {
                    tag: 'Left Column (50%)',
                    title: 'Primary Narrative Card',
                    body: 'Anchored headline, short supporting summary, and primary CTA filling full track height.'
                },
                rightCards: [
                    { title: 'Upper Stacked Card', subtitle: 'Summary metric + action icon', badge: 'Flex: 1' },
                    { title: 'Lower Stacked Card', subtitle: 'Interactive visual preview tile', badge: 'Flex: 1' }
                ]
            },
            codeSnippet: {
                language: 'css',
                code: '.bento-split {\n  display: grid;\n  grid-template-columns: 1fr 1fr;\n  gap: 20px;\n}\n.right-stack {\n  display: flex;\n  flex-direction: column;\n  gap: 20px;\n}'
            },
            callout: 'Rule of thumb: Use CSS Grid for 2D tracks and Flexbox when stacking items in one axis.',
            speakerNotes: 'Ask students which axis CSS Grid controls vs Flexbox on the right column.',
            durationSeconds: 75
        },
        {
            id: 'sample_slide_4',
            order: 3,
            layout: 'checkup',
            motion: 'pop',
            title: 'Check-Up #1: Semantic Landmarks',
            subtitle: 'Live Student Pulse Poll',
            checkupQuestion: {
                question: 'Which HTML landmark element should wrap the unique dominant content of a web page?',
                options: ['<div class="wrapper">', '<main>', '<footer>', '<meta>'],
                correctAnswer: 1,
                explanation: 'Using <main> exposes an explicit ARIA landmark so assistive technologies can skip repeated navigation headers cleanly.',
                points: 10
            },
            speakerNotes: 'Give students 20 seconds to vote live before clicking Reveal Answer.',
            durationSeconds: 45
        },
        {
            id: 'sample_slide_5',
            order: 4,
            layout: 'code',
            motion: 'slide-left',
            title: '3. Clean Component Card Pattern',
            subtitle: 'Accessible & responsive markup',
            body: 'Keep component HTML shallow, semantic, and decoupled from presentation overrides:',
            bullets: [
                'Use heading levels sequentially without skipping h1 to h4.',
                'Prefer semantic buttons for actions instead of clickable div elements.',
                'Use gap utility rules instead of uneven margins between sibling cards.',
                'Keep hover and focus states crisp across light and dark themes.'
            ],
            codeSnippet: {
                language: 'html',
                code: '<article class="feature-card">\n  <span class="tag">Core Pattern</span>\n  <h2>Accessible Cards</h2>\n  <p>Semantic headings preserve focus flow.</p>\n  <button type="button">Inspect Spec</button>\n</article>'
            },
            callout: 'Pro Tip: Switch to Pen Mode in the toolbar to circle button type attributes live.',
            speakerNotes: 'Highlight why button elements automatically handle Enter/Space keyboard activation.',
            durationSeconds: 65
        },
        {
            id: 'sample_slide_6',
            order: 5,
            layout: 'wireframe',
            motion: 'fade-up',
            title: '4. Multi-Column Footer Breakdown',
            subtitle: 'Top strip + 3 balanced directory columns',
            body: 'A scalable footer splits navigation echo at the top from grouped informational columns below:',
            visualBlock: {
                kind: 'footer-anatomy',
                topNav: {
                    brand: 'QuizLab Studio',
                    links: ['Tracks', 'Quizzes', 'Arena', 'Docs']
                },
                columns: [
                    { title: 'Curriculum', items: ['Web Foundations', 'Algorithms & DS', 'System Design'] },
                    { title: 'Community', items: ['Classrooms', 'Tournaments', 'Leaderboard'] },
                    { title: 'Support', items: ['help@quizlab.dev', 'Shortcuts Guide', 'Status Page'] }
                ]
            },
            callout: 'Collapse 3 columns into a single clean stack below 640px for effortless mobile scrolling.',
            speakerNotes: 'Inspect each footer column live and trace responsive grid wrapping.',
            durationSeconds: 65
        },
        {
            id: 'sample_slide_7',
            order: 6,
            layout: 'comparison',
            motion: 'stagger',
            title: '5. Flexbox vs CSS Grid Decision Matrix',
            subtitle: 'Choosing the right tool cleanly',
            body: 'Avoid forcing one layout engine everywhere—match layout capabilities to card alignment needs:',
            bullets: [
                'Flexbox excels along a single row or column where content dictates item width.',
                'CSS Grid enforces predictable 2D row and column tracks across breakpoints.',
                'Nested combinations (Grid shell + Flex cards) handle 95% of UI dashboards.',
                'Test narrow viewports (375px) early so cards never overflow horizontally.'
            ],
            callout: 'Never nest unnecessary wrapper divs when gap and grid-template-columns solve alignment directly.',
            speakerNotes: 'Run a quick thumbs-up reaction check to verify everyone understands Grid vs Flex.',
            durationSeconds: 60
        },
        {
            id: 'sample_slide_8',
            order: 7,
            layout: 'homework',
            motion: 'fade-up',
            title: 'Session Wrap-Up & Practice Lab',
            subtitle: 'Next Steps & Unlocked Homework',
            body: 'Apply today’s semantic blueprint rules to complete the assigned layout challenge and session assessment:',
            bullets: [
                'Audit your project HTML to ensure clear header, main, and footer landmarks.',
                'Implement a 2-column Grid split that stacks cleanly on mobile viewports.',
                'Complete the unlocked Session Homework Quiz before next class.'
            ],
            callout: 'Instructors: Click Finish Session & Unlock Homework below once review is complete.',
            speakerNotes: 'Summarize takeaways, answer final questions, and unlock session homework.',
            durationSeconds: 45
        }
    ]
};

export const SAMPLE_MINIMAL_PRESENTATION: Omit<MotionPresentation, 'presentationId'> = {
    title: 'My New Session Deck',
    description: 'Minimal starter presentation template ready for editing.',
    theme: 'bento',
    sourceFormat: 'json',
    slides: [
        {
            id: 'slide_1',
            order: 0,
            layout: 'hero',
            motion: 'zoom-in',
            title: 'Topic Overview',
            subtitle: 'Module Introduction',
            body: 'Short introduction to the session topic.',
            bullets: ['Objective 1', 'Objective 2'],
            speakerNotes: 'Introduce today’s topic.',
            durationSeconds: 45
        },
        {
            id: 'slide_2',
            order: 1,
            layout: 'bullets',
            motion: 'stagger',
            title: 'Key Concepts',
            bullets: ['First key concept', 'Second key concept', 'Third key concept'],
            callout: 'Remember this key rule!',
            speakerNotes: 'Explain each concept with a concrete example.',
            durationSeconds: 60
        },
        {
            id: 'slide_3',
            order: 2,
            layout: 'checkup',
            motion: 'pop',
            title: 'Quick Check-Up',
            checkupQuestion: {
                question: 'Sample check-up question?',
                options: ['Option A', 'Option B', 'Option C', 'Option D'],
                correctAnswer: 0,
                explanation: 'Explain why Option A is right.',
                points: 10
            },
            speakerNotes: 'Review the poll results together.',
            durationSeconds: 45
        }
    ]
};
