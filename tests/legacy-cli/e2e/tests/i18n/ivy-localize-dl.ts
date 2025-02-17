import { appendToFile, expectFileToMatch } from '../../utils/fs';
import { ng } from '../../utils/process';
import { updateJsonFile } from '../../utils/project';
import { expectToFail } from '../../utils/utils';
import { baseDir, externalServer, langTranslations, setupI18nConfig } from './legacy';


export default async function () {
  // Setup i18n tests and config.
  await setupI18nConfig();

  // Ensure a DL build is used.
  await updateJsonFile('tsconfig.json', config => {
    config.compilerOptions.target = 'es2015';
    config.angularCompilerOptions.disableTypeScriptVersionCheck = true;
  });

  // TODO: re-enable all locales once localeData support is added.
  const tempLangTranslations = langTranslations.filter(l => l.lang == 'fr');

  // Build each locale and verify the output.
  // NOTE: this should not fail in general, but multi-locale translation is currently disabled.
  // TODO: remove expectToFail once localeData support is added.
  await expectToFail(() => ng('build', '--localize', 'true'));
  await ng('build');
  for (const { lang, outputPath, translation } of tempLangTranslations) {
    await expectFileToMatch(`${outputPath}/main-es5.js`, translation.helloPartial);
    await expectFileToMatch(`${outputPath}/main-es2015.js`, translation.helloPartial);
    await expectToFail(() => expectFileToMatch(`${outputPath}/main-es5.js`, '$localize`'));
    await expectToFail(() => expectFileToMatch(`${outputPath}/main-es2015.js`, '$localize`'));
    await expectFileToMatch(`${outputPath}/main-es5.js`, lang);
    await expectFileToMatch(`${outputPath}/main-es2015.js`, lang);

    const server = externalServer(outputPath);
    try {
      // Execute without a devserver.
      await ng('e2e', `--configuration=${lang}`, '--devServerTarget=');
    } finally {
      server.close();
    }
  }

  // Verify missing translation behaviour.
  await appendToFile('src/app/app.component.html', '<p i18n>Other content</p>');
  await ng('build', '--i18n-missing-translation', 'ignore');
  await expectFileToMatch(`${baseDir}/fr/main-es5.js`, /Other content/);
  await expectFileToMatch(`${baseDir}/fr/main-es2015.js`, /Other content/);
  await expectToFail(() => ng('build'));
}
