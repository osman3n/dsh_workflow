/**
 * Client half of the workflow-kit panel.
 *
 * Registers a sidebar icon and the matching main-panel page. The page talks to
 * the host service through the Typert remote gateway (`ctx.remote.workflows`),
 * so listing and saving stay on the host side where the registry lives.
 */

window.__ModuleLoader__.load({
  id: '@osman3n/dsh-workflow-kit',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const useState = React.useState;
    const useEffect = React.useEffect;
    const useCallback = React.useCallback;

    const PANEL_ID = 'workflows';
    const NS = '@osman3n/dsh-workflow-kit.panel';
    const PACKAGE = '@osman3n/dsh-workflow-kit';

    const identity = (value) => value;
    const strictSchema = { parse: identity };
    const codec = (typeSymbol) => ({ mode: 'strict', typeSymbol, create: () => strictSchema });

    const CONTRIBUTION = {
      package: PACKAGE,
      descriptors: [
        {
          id: `${PACKAGE}#workflows/list`,
          service: 'workflows',
          namespace: 'workflows',
          method: 'list',
          invocation: { kind: 'direct' },
          parameters: [
            {
              name: 'payload',
              wire: 'payload',
              source: 'json',
              acceptsUndefined: true,
              codec: codec(`${PACKAGE}#workflows/list/payload`)
            }
          ],
          result: codec(`${PACKAGE}#workflows/list/result`)
        },
        {
          id: `${PACKAGE}#workflows/save`,
          service: 'workflows',
          namespace: 'workflows',
          method: 'save',
          invocation: { kind: 'direct' },
          parameters: [
            {
              name: 'request',
              wire: 'request',
              source: 'json',
              acceptsUndefined: true,
              codec: codec(`${PACKAGE}#workflows/save/request`)
            }
          ],
          result: codec(`${PACKAGE}#workflows/save/result`)
        }
      ]
    };

    const DICTS = {
      en: {
        panelTitle: 'Workflows',
        subtitle: 'Reusable capsules the workflow engine can run by name.',
        reviewTitle: 'Workflow capsules',
        newWorkflow: 'New workflow',
        refresh: 'Refresh',
        back: 'Back to conversation',
        cancel: 'Cancel',
        save: 'Save workflow',
        saving: 'Saving…',
        name: 'Name',
        nameHint: 'kebab-case, unique in the personal scope',
        intent: 'Intent',
        intentHint: 'one line describing what the workflow achieves',
        whenToUse: 'When to use',
        whenToUseHint: 'optional routing hint for the model',
        body: 'Body',
        bodyHint: 'Uses args, agent, parallel, pipeline, phase and log; ends with return <value>.',
        overwrite: 'Replace an existing capsule with the same name',
        empty: 'No capsules yet — create one to get started.',
        loading: 'Loading workflows…',
        loadFailed: 'Could not load workflows.',
        saveFailed: 'Could not save the workflow.',
        saved: 'Saved',
        scope: 'scope',
        inputs: 'inputs',
        phases: 'phases',
        noInputs: 'no inputs',
        searchDirs: 'Search order',
        problems: 'Invalid capsule files',
        retry: 'Try again',
        required: 'Required'
      },
      zh: {
        panelTitle: '工作流',
        subtitle: '工作流引擎可按名称运行的可复用胶囊。',
        reviewTitle: '工作流胶囊',
        newWorkflow: '新建工作流',
        refresh: '刷新',
        back: '返回对话',
        cancel: '取消',
        save: '保存工作流',
        saving: '保存中…',
        name: '名称',
        nameHint: 'kebab-case，在个人作用域内唯一',
        intent: '意图',
        intentHint: '一句话描述该工作流完成什么',
        whenToUse: '使用时机',
        whenToUseHint: '可选的模型路由提示',
        body: '正文',
        bodyHint: '使用 args、agent、parallel、pipeline、phase 和 log，并以 return <value> 结尾。',
        overwrite: '覆盖同名的现有胶囊',
        empty: '还没有胶囊——先创建一个。',
        loading: '正在加载工作流…',
        loadFailed: '无法加载工作流。',
        saveFailed: '无法保存工作流。',
        saved: '已保存',
        scope: '作用域',
        inputs: '输入',
        phases: '阶段',
        noInputs: '无输入',
        searchDirs: '搜索顺序',
        problems: '无效的胶囊文件',
        retry: '重试',
        required: '必填'
      }
    };

    /** Small flow glyph for the sidebar rail. */
    function WorkflowIcon(props) {
      const size = Number.isFinite(props?.size) && props.size > 0 ? props.size : 16;
      return h(
        'svg',
        {
          width: size,
          height: size,
          viewBox: '0 0 16 16',
          fill: 'none',
          'aria-hidden': true,
          focusable: 'false'
        },
        h('rect', { x: 1.5, y: 2.5, width: 5, height: 4, rx: 1, stroke: 'currentColor', strokeWidth: 1.2 }),
        h('rect', { x: 9.5, y: 2.5, width: 5, height: 4, rx: 1, stroke: 'currentColor', strokeWidth: 1.2 }),
        h('rect', { x: 1.5, y: 9.5, width: 5, height: 4, rx: 1, stroke: 'currentColor', strokeWidth: 1.2 }),
        h('rect', { x: 9.5, y: 9.5, width: 5, height: 4, rx: 1, stroke: 'currentColor', strokeWidth: 1.2 }),
        h('path', {
          d: 'M6.5 4.5h3M4 6.5v3M12 6.5v3M6.5 11.5h3',
          stroke: 'currentColor',
          strokeWidth: 1.2,
          strokeLinecap: 'round'
        })
      );
    }

    const styles = {
      page: {
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        overflowY: 'auto',
        padding: '28px 24px 40px',
        color: 'var(--dsw-alias-label-primary)',
        background: 'var(--dsw-alias-bg-base)',
        boxSizing: 'border-box'
      },
      inner: { width: '100%', maxWidth: 860, margin: '0 auto' },
      header: {
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 16,
        marginBottom: 20
      },
      title: { fontSize: 22, fontWeight: 600, lineHeight: 1.2, margin: 0 },
      subtitle: { marginTop: 6, fontSize: 13, color: 'var(--dsw-alias-label-secondary)' },
      actions: { display: 'flex', gap: 8, flexShrink: 0 },
      primaryButton: {
        appearance: 'none',
        border: '1px solid transparent',
        borderRadius: 8,
        padding: '7px 14px',
        fontSize: 13,
        fontWeight: 600,
        cursor: 'pointer',
        background: 'var(--dsw-alias-brand-primary)',
        color: 'var(--dsw-alias-bg-base)'
      },
      secondaryButton: {
        appearance: 'none',
        border: '1px solid var(--dsw-alias-border-l2)',
        borderRadius: 8,
        padding: '7px 14px',
        fontSize: 13,
        cursor: 'pointer',
        background: 'transparent',
        color: 'var(--dsw-alias-label-primary)'
      },
      ghostButton: {
        appearance: 'none',
        border: 'none',
        padding: '2px 0',
        fontSize: 13,
        cursor: 'pointer',
        background: 'transparent',
        color: 'var(--dsw-alias-label-secondary)'
      },
      card: {
        border: '1px solid var(--dsw-alias-border-l1)',
        borderRadius: 10,
        padding: 16,
        marginBottom: 10,
        background: 'var(--dsw-alias-bg-layer-1)'
      },
      cardHead: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
      cardName: { fontSize: 15, fontWeight: 600, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' },
      badge: {
        fontSize: 11,
        lineHeight: '18px',
        padding: '0 8px',
        borderRadius: 999,
        background: 'var(--dsw-alias-bg-layer-2)',
        color: 'var(--dsw-alias-label-secondary)',
        border: '1px solid var(--dsw-alias-border-l1)'
      },
      cardIntent: { marginTop: 8, fontSize: 13, lineHeight: 1.5 },
      meta: { marginTop: 6, fontSize: 12, color: 'var(--dsw-alias-label-secondary)' },
      path: {
        marginTop: 8,
        fontSize: 11,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        color: 'var(--dsw-alias-label-secondary)',
        wordBreak: 'break-all'
      },
      field: { display: 'block', marginBottom: 14 },
      label: { display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 5 },
      hint: { display: 'block', fontSize: 11, color: 'var(--dsw-alias-label-secondary)', marginBottom: 6 },
      input: {
        width: '100%',
        boxSizing: 'border-box',
        border: '1px solid var(--dsw-alias-border-l1)',
        borderRadius: 8,
        padding: '8px 10px',
        fontSize: 13,
        color: 'var(--dsw-alias-label-primary)',
        background: 'var(--dsw-alias-bg-base)',
        outline: 'none'
      },
      textarea: {
        width: '100%',
        boxSizing: 'border-box',
        border: '1px solid var(--dsw-alias-border-l1)',
        borderRadius: 8,
        padding: '10px',
        fontSize: 12,
        lineHeight: 1.55,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        color: 'var(--dsw-alias-label-primary)',
        background: 'var(--dsw-alias-bg-base)',
        resize: 'vertical'
      },
      error: {
        marginTop: 12,
        padding: '10px 12px',
        borderRadius: 8,
        border: '1px solid var(--dsw-alias-state-error-primary)',
        color: 'var(--dsw-alias-state-error-primary)',
        fontSize: 12,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word'
      },
      notice: {
        marginBottom: 16,
        padding: '8px 12px',
        borderRadius: 8,
        fontSize: 12,
        color: 'var(--dsw-alias-state-success-primary)',
        border: '1px solid var(--dsw-alias-border-l1)',
        background: 'var(--dsw-alias-bg-layer-1)'
      },
      empty: {
        border: '1px dashed var(--dsw-alias-border-l2)',
        borderRadius: 10,
        padding: '28px 20px',
        textAlign: 'center',
        fontSize: 13,
        color: 'var(--dsw-alias-label-secondary)'
      },
      dirs: { marginTop: 24, fontSize: 11, color: 'var(--dsw-alias-label-secondary)' },
      dirRow: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', marginTop: 4, wordBreak: 'break-all' },
      formActions: { display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 },
      checkboxRow: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, marginBottom: 14 }
    };

    function CapsuleCard({ workflow, t }) {
      const inputs = Array.isArray(workflow.inputs) ? workflow.inputs : [];
      const phases = Array.isArray(workflow.phases) ? workflow.phases : [];
      const tags = Array.isArray(workflow.tags) ? workflow.tags : [];
      return h(
        'div',
        { style: styles.card },
        h(
          'div',
          { style: styles.cardHead },
          h('span', { style: styles.cardName }, workflow.name),
          h('span', { style: styles.badge }, workflow.scope),
          h('span', { style: styles.badge }, `${inputs.length} ${t('inputs')}`),
          phases.length > 0 ? h('span', { style: styles.badge }, `${phases.length} ${t('phases')}`) : null
        ),
        h('div', { style: styles.cardIntent }, workflow.intent),
        workflow.whenToUse ? h('div', { style: styles.meta }, `when: ${workflow.whenToUse}`) : null,
        inputs.length > 0
          ? h('div', { style: styles.meta }, `inputs: ${inputs.map((input) => input.name).join(', ')}`)
          : h('div', { style: styles.meta }, t('noInputs')),
        tags.length > 0 ? h('div', { style: styles.meta }, `tags: ${tags.join(', ')}`) : null,
        h('div', { style: styles.path }, workflow.path),
        workflow.alsoIn ? h('div', { style: styles.meta }, `shadowing: ${workflow.alsoIn}`) : null
      );
    }

    function WorkflowPanelPage(props) {
      const t = props.t;
      const callRemote = props.callRemote;
      const close = props.close;

      const [state, setState] = useState({ status: 'loading', data: null, error: '' });
      const [notice, setNotice] = useState('');
      const [form, setForm] = useState(null);
      const [saving, setSaving] = useState(false);
      const [formError, setFormError] = useState('');

      const refresh = useCallback(async () => {
        setState((current) => ({ status: current.data ? 'refreshing' : 'loading', data: current.data, error: '' }));
        try {
          const data = await callRemote('list', [{}]);
          setState({ status: 'ready', data, error: '' });
        } catch (error) {
          setState({ status: 'error', data: null, error: error instanceof Error ? error.message : String(error) });
        }
      }, [callRemote]);

      useEffect(() => {
        void refresh();
      }, [refresh]);

      const openForm = () => {
        setNotice('');
        setFormError('');
        setForm({ name: '', intent: '', whenToUse: '', script: '', overwrite: false });
      };
      const closeForm = () => {
        if (saving) return;
        setForm(null);
        setFormError('');
      };
      const setField = (key) => (event) => {
        const value = event?.target?.type === 'checkbox' ? event.target.checked : event.target.value;
        setForm((current) => (current ? { ...current, [key]: value } : current));
      };

      const submit = async (event) => {
        event.preventDefault();
        if (!form || saving) return;
        setSaving(true);
        setFormError('');
        try {
          const saved = await callRemote('save', [
            {
              name: form.name,
              intent: form.intent,
              whenToUse: form.whenToUse,
              script: form.script,
              overwrite: form.overwrite === true
            }
          ]);
          setNotice(`${t('saved')}: ${saved?.name ?? form.name}`);
          setForm(null);
          await refresh();
        } catch (error) {
          setFormError(error instanceof Error ? error.message : String(error));
        } finally {
          setSaving(false);
        }
      };

      const workflows = state.data?.workflows ?? [];
      const problems = state.data?.problems ?? [];
      const dirs = state.data?.dirs ?? [];

      return h(
        'div',
        { style: styles.page },
        h(
          'div',
          { style: styles.inner },
          h(
            'div',
            { style: styles.header },
            h(
              'div',
              null,
              h('button', { type: 'button', style: styles.ghostButton, onClick: close }, `← ${t('back')}`),
              h('h1', { style: { ...styles.title, marginTop: 10 } }, t('panelTitle')),
              h('div', { style: styles.subtitle }, t('subtitle'))
            ),
            h(
              'div',
              { style: styles.actions },
              h('button', { type: 'button', style: styles.secondaryButton, onClick: () => void refresh(), disabled: state.status === 'loading' }, t('refresh')),
              h('button', { type: 'button', style: styles.primaryButton, onClick: openForm }, t('newWorkflow'))
            )
          ),
          notice ? h('div', { style: styles.notice }, notice) : null,
          form ? renderForm() : renderList()
        )
      );

      function renderList() {
        if (state.status === 'loading') {
          return h('div', { style: styles.empty }, t('loading'));
        }
        if (state.status === 'error') {
          return h(
            'div',
            null,
            h('div', { style: styles.error }, `${t('loadFailed')}\n${state.error}`),
            h('div', { style: { marginTop: 12 } }, h('button', { type: 'button', style: styles.secondaryButton, onClick: () => void refresh() }, t('retry')))
          );
        }
        return h(
          'div',
          null,
          workflows.length === 0
            ? h('div', { style: styles.empty }, t('empty'))
            : h('div', null, workflows.map((workflow) => h(CapsuleCard, { key: workflow.name, workflow, t }))),
          problems.length > 0
            ? h(
                'div',
                { style: { marginTop: 24 } },
                h('div', { style: { ...styles.label, marginBottom: 8 } }, t('problems')),
                problems.map((problem) =>
                  h(
                    'div',
                    { key: `${problem.scope}:${problem.path}`, style: { ...styles.card, borderColor: 'var(--dsw-alias-state-error-primary)' } },
                    h('div', { style: styles.cardName }, problem.name),
                    h('div', { style: styles.path }, problem.path),
                    h('div', { style: { ...styles.meta, color: 'var(--dsw-alias-state-error-primary)' } }, problem.error)
                  )
                )
              )
            : null,
          dirs.length > 0
            ? h(
                'div',
                { style: styles.dirs },
                h('div', null, t('searchDirs')),
                dirs.map((entry) =>
                  h('div', { key: entry.dir, style: styles.dirRow }, `${entry.exists ? '✓' : '·'} ${entry.scope}  ${entry.dir}`)
                )
              )
            : null
        );
      }

      function renderForm() {
        return h(
          'form',
          { onSubmit: submit, style: { ...styles.card, padding: 20 } },
          h('div', { style: { fontSize: 16, fontWeight: 600, marginBottom: 16 } }, t('newWorkflow')),
          h(
            'label',
            { style: styles.field },
            h('span', { style: styles.label }, `${t('name')} *`),
            h('span', { style: styles.hint }, t('nameHint')),
            h('input', { style: styles.input, value: form.name, onChange: setField('name'), placeholder: 'release-check' })
          ),
          h(
            'label',
            { style: styles.field },
            h('span', { style: styles.label }, `${t('intent')} *`),
            h('span', { style: styles.hint }, t('intentHint')),
            h('input', { style: styles.input, value: form.intent, onChange: setField('intent'), placeholder: 'Check the release for regressions' })
          ),
          h(
            'label',
            { style: styles.field },
            h('span', { style: styles.label }, t('whenToUse')),
            h('span', { style: styles.hint }, t('whenToUseHint')),
            h('input', { style: styles.input, value: form.whenToUse, onChange: setField('whenToUse') })
          ),
          h(
            'label',
            { style: styles.field },
            h('span', { style: styles.label }, `${t('body')} *`),
            h('span', { style: styles.hint }, t('bodyHint')),
            h('textarea', {
              style: styles.textarea,
              rows: 10,
              value: form.script,
              onChange: setField('script'),
              placeholder: "const findings = await agent('Investigate the release diffs');\nreturn findings;"
            })
          ),
          h(
            'label',
            { style: styles.checkboxRow },
            h('input', { type: 'checkbox', checked: form.overwrite, onChange: setField('overwrite') }),
            h('span', null, t('overwrite'))
          ),
          formError ? h('div', { style: styles.error }, `${t('saveFailed')}\n${formError}`) : null,
          h(
            'div',
            { style: styles.formActions },
            h('button', { type: 'button', style: styles.secondaryButton, onClick: closeForm, disabled: saving }, t('cancel')),
            h('button', { type: 'submit', style: styles.primaryButton, disabled: saving }, saving ? t('saving') : t('save'))
          )
        );
      }
    }

    return {
      inject: ['slots', 'locale', 'remote', 'layout'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, DICTS), 'workflow-kit: panel strings');
        const t = ctx.locale.bind(NS);

        let mounted;
        const ensureMounted = () => {
          if (!mounted) mounted = Promise.resolve(ctx.remote.$mount(CONTRIBUTION));
          return mounted;
        };

        const callRemote = async (method, args) => {
          await ensureMounted();
          const remote = ctx.get('remote.workflows');
          if (!remote || typeof remote[method] !== 'function') {
            throw new Error(`remote workflows.${method} is unavailable`);
          }
          const result = await remote[method](...args);
          if (result && result.ok === false) {
            const failure = result.error;
            throw new Error(String(failure?.message ?? failure?.code ?? 'workflow service call failed'));
          }
          return result && result.ok === true ? result.value : result;
        };

        const close = () => {
          const layout = ctx.get('layout');
          if (layout && typeof layout.selectPanel === 'function') layout.selectPanel(null);
        };

        const Page = () => h(WorkflowPanelPage, { t, callRemote, close });

        ctx.slots.inject('sidebar.panellist', () =>
          ctx.slots.register(
            {
              name: 'sidebar.panellist',
              id: PANEL_ID,
              order: 40,
              label: () => t('panelTitle'),
              locale: NS
            },
            WorkflowIcon
          )
        );

        ctx.slots.register({ name: 'main', key: PANEL_ID, locale: NS }, Page);
      }
    };
  }
});
