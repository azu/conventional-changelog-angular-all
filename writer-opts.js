"use strict";

const compareFunc = require(`compare-func`);
const Q = require(`q`);
const readFile = Q.denodeify(require(`fs`).readFile);
const resolve = require(`path`).resolve;
const conventionalCommitTypes = require(`conventional-commit-types`);

module.exports = Q.all([
    readFile(resolve(__dirname, `./templates/template.hbs`), `utf-8`),
    readFile(resolve(__dirname, `./templates/header.hbs`), `utf-8`),
    readFile(resolve(__dirname, `./templates/commit.hbs`), `utf-8`),
    readFile(resolve(__dirname, `./templates/footer.hbs`), `utf-8`)
]).spread((template, header, commit, footer) => {
    const writerOpts = getWriterOpts();

    writerOpts.mainTemplate = template;
    writerOpts.headerPartial = header;
    writerOpts.commitPartial = commit;
    writerOpts.footerPartial = footer;

    return writerOpts;
});

function getWriterOpts() {
    return {
        transform: (commit, context) => {
            const issues = [];

            commit.notes.forEach(note => {
                note.title = `BREAKING CHANGES`;
            });

            const matchedType = conventionalCommitTypes.types[commit.type];
            if (matchedType) {
                commit.type = matchedType.title;
            } else {
                return undefined; // ignore other type
            }

            if (commit.scope === `*`) {
                commit.scope = ``;
            }

            if (typeof commit.hash === `string`) {
                commit.hash = commit.hash.substring(0, 7);
            }

            if (typeof commit.subject === `string`) {
                let url = context.repository
                    ? `${context.host}/${context.owner}/${context.repository}`
                    : context.repoUrl;
                if (url) {
                    url = `${url}/issues/`;
                    // Issue URLs.
                    commit.subject = commit.subject.replace(/#([0-9]+)/g, (_, issue) => {
                        issues.push(issue);
                        return `[#${issue}](${url}${issue})`;
                    });
                }
                if (context.host) {
                    // User URLs.
                    commit.subject = commit.subject.replace(
                        /\B@([a-z0-9](?:-?[a-z0-9]){0,38})/g,
                        `[@$1](${context.host}/$1)`
                    );
                }
            }

            // remove references that already appear in the subject
            commit.references = commit.references.filter(reference => {
                if (issues.indexOf(reference.issue) === -1) {
                    return true;
                }

                return false;
            });

            return commit;
        },
        groupBy: `type`,
        commitGroupsSort: `title`,
        commitsSort: [`scope`, `subject`],
        noteGroupsSort: `title`,
        notesSort: compareFunc
    };
}
