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
    const useMemo = React.useMemo;
    const useRef = React.useRef;
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
        navCombined: 'Workflows',
        reviewTitle: 'Workflow capsules',
        newWorkflow: 'New workflow',
        refresh: 'Refresh',
        refreshing: 'Refreshing…',
        back: 'Back to conversation',
        cancel: 'Cancel',
        save: 'Save workflow',
        saving: 'Saving…',
        name: 'Name',
        nameHint: 'Letters, digits, dot, underscore or dash; max 64 characters.',
        namePlaceholder: 'release-check',
        intent: 'Intent',
        intentHint: 'One line describing what the workflow achieves.',
        intentPlaceholder: 'Check the release for regressions',
        whenToUse: 'When to use',
        whenToUseHint: 'Optional routing hint for the model.',
        body: 'Body',
        bodyHint: 'Uses args, agent, parallel, pipeline, phase and log; ends with return <value>.',
        bodyPlaceholder: "const findings = await agent('Investigate the release diffs');\nreturn findings;",
        bodyNote: 'The engine wraps this body. Top-level import/export is rejected.',
        overwrite: 'Replace an existing capsule with the same name',
        emptyTitle: 'No workflow capsules yet',
        emptyBody:
          'Capsules are reusable agent workflows the model can run by name. Create one here, or drop a .workflow.json file into a search directory below.',
        emptyCta: 'Create your first workflow',
        loading: 'Loading workflows…',
        loadingAria: 'Loading',
        loadFailed: 'Could not load workflows.',
        saveFailed: 'Could not save the workflow.',
        saved: 'Saved',
        savedToPersonal: 'Saved to the personal scope',
        retry: 'Try again',
        searchPlaceholder: 'Search capsules…',
        searchLabel: 'Search capsules',
        clearSearch: 'Clear search',
        allScopes: 'All',
        countCapsules: 'capsules',
        countMatches: 'shown',
        noMatches: 'No capsules match this search.',
        noMatchesQuery: 'No capsules match',
        clearFilters: 'Clear filters',
        details: 'Details',
        showDetails: 'Show details',
        hideDetails: 'Hide details',
        whenLabel: 'When to use',
        inputsLabel: 'Inputs',
        phasesLabel: 'Phases',
        tagsLabel: 'Tags',
        pathLabel: 'Path',
        shadowLabel: 'Shadowing',
        shadowHint: 'A capsule in a higher-priority scope overrides this name.',
        inputsCount: 'inputs',
        phasesCount: 'phases',
        tagsCount: 'tags',
        noInputs: 'No declared inputs',
        scopeBuiltin: 'Builtin',
        scopeProject: 'Project',
        scopePersonal: 'Personal',
        scopeFilter: 'Filter by scope',
        problems: 'Invalid capsule files',
        problemsHint: 'These files are skipped until they are fixed.',
        searchDirs: 'Search order',
        dirExists: 'available',
        dirMissing: 'not created yet',
        chatCreate: 'Create with chat',
        chatCreateHint: 'Opens a chat that guides you through the workflow and saves it.',
        chatImprove: 'Improve with chat',
        chatImproveHint: 'Discuss changes in a chat; the assistant saves the new version.',
        orCreateWithChat: 'Or create it with chat',
        chatUnavailable: 'Chat is not available in this window.',
        formTitle: 'New workflow',
        formNote: 'Saves to your personal scope (DSH_HOME/workflows).',
        required: 'Required',
        nameInvalid:
          'Start with a letter or digit; use only letters, digits, dot, underscore or dash (max 64 characters).',
        scriptEsm: 'The engine wraps the body: remove top-level import/export statements.',
        scriptReturn: 'The script has no return statement, so the run result will be undefined.',
        chars: 'characters',
        expand: 'Show details',
        collapse: 'Hide details'
      },
      zh: {
        panelTitle: '工作流',
        subtitle: '工作流引擎可按名称运行的可复用胶囊。',
        navCombined: '工作流',
        reviewTitle: '工作流胶囊',
        newWorkflow: '新建工作流',
        refresh: '刷新',
        refreshing: '刷新中…',
        back: '返回对话',
        cancel: '取消',
        save: '保存工作流',
        saving: '保存中…',
        name: '名称',
        nameHint: '字母、数字、点、下划线或短横线；最多 64 个字符。',
        namePlaceholder: 'release-check',
        intent: '意图',
        intentHint: '一句话描述该工作流完成什么。',
        intentPlaceholder: '检查发布是否有回归',
        whenToUse: '使用时机',
        whenToUseHint: '可选的模型路由提示。',
        body: '正文',
        bodyHint: '使用 args、agent、parallel、pipeline、phase 和 log，并以 return <value> 结尾。',
        bodyPlaceholder: "const findings = await agent('调查发布差异');\nreturn findings;",
        bodyNote: '引擎会包裹此正文；不允许顶层 import/export。',
        overwrite: '覆盖同名的现有胶囊',
        emptyTitle: '还没有工作流胶囊',
        emptyBody: '胶囊是可按名称运行的可复用智能体工作流。在这里创建，或把 .workflow.json 放进下面的搜索目录。',
        emptyCta: '创建第一个工作流',
        loading: '正在加载工作流…',
        loadingAria: '加载中',
        loadFailed: '无法加载工作流。',
        saveFailed: '无法保存工作流。',
        saved: '已保存',
        savedToPersonal: '已保存到个人作用域',
        retry: '重试',
        searchPlaceholder: '搜索胶囊…',
        searchLabel: '搜索胶囊',
        clearSearch: '清除搜索',
        allScopes: '全部',
        countCapsules: '个胶囊',
        countMatches: '个匹配',
        noMatches: '没有匹配的胶囊。',
        noMatchesQuery: '没有匹配的胶囊',
        clearFilters: '清除筛选',
        details: '详情',
        showDetails: '展开详情',
        hideDetails: '收起详情',
        whenLabel: '使用时机',
        inputsLabel: '输入',
        phasesLabel: '阶段',
        tagsLabel: '标签',
        pathLabel: '路径',
        shadowLabel: '覆盖关系',
        shadowHint: '更高优先级作用域中的同名胶囊会覆盖它。',
        inputsCount: '个输入',
        phasesCount: '个阶段',
        tagsCount: '个标签',
        noInputs: '未声明输入',
        scopeBuiltin: '内置',
        scopeProject: '项目',
        scopePersonal: '个人',
        scopeFilter: '按作用域筛选',
        problems: '无效的胶囊文件',
        problemsHint: '这些文件在修复前会被跳过。',
        searchDirs: '搜索顺序',
        dirExists: '可用',
        dirMissing: '尚未创建',
        chatCreate: '用聊天创建',
        chatCreateHint: '打开聊天，由助手引导完成并保存工作流。',
        chatImprove: '用聊天改进',
        chatImproveHint: '在聊天中讨论修改；助手会保存新版本。',
        orCreateWithChat: '或用聊天创建',
        chatUnavailable: '此窗口不支持聊天。',
        formTitle: '新建工作流',
        formNote: '保存到个人作用域（DSH_HOME/workflows）。',
        required: '必填',
        nameInvalid: '以字母或数字开头；仅含字母、数字、点、下划线或短横线（最多 64 个字符）。',
        scriptEsm: '引擎会包裹正文：请移除顶层 import/export 语句。',
        scriptReturn: '脚本没有 return 语句，运行结果将为 undefined。',
        chars: '个字符',
        expand: '展开详情',
        collapse: '收起详情'
      }
    };

    /* ---------------------------------------------------------------- icons */

    function iconProps(props) {
      const size = Number.isFinite(props?.size) && props.size > 0 ? props.size : 16;
      return {
        width: size,
        height: size,
        viewBox: '0 0 16 16',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.5,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        'aria-hidden': true,
        focusable: 'false'
      };
    }

    function FlowIcon(props) {
      return h(
        'svg',
        iconProps(props),
        h('rect', { x: 2, y: 2.5, width: 4.5, height: 3.5, rx: 1 }),
        h('rect', { x: 9.5, y: 2.5, width: 4.5, height: 3.5, rx: 1 }),
        h('rect', { x: 2, y: 10, width: 4.5, height: 3.5, rx: 1 }),
        h('rect', { x: 9.5, y: 10, width: 4.5, height: 3.5, rx: 1 }),
        h('path', { d: 'M6.5 4.2h3M4.2 6v4M11.8 6v4M6.5 11.8h3' })
      );
    }

    const IconSearch = (props) =>
      h('svg', iconProps(props), h('circle', { cx: 7, cy: 7, r: 4.25 }), h('path', { d: 'M10.2 10.2 14 14' }));

    const IconPlus = (props) => h('svg', iconProps(props), h('path', { d: 'M8 3v10M3 8h10' }));

    const IconChat = (props) =>
      h(
        'svg',
        iconProps(props),
        h('path', { d: 'M2.5 3.2h11v7.2H8.2L4.6 13.4v-3H2.5V3.2Z' }),
        h('path', { d: 'M5 6h6M5 8.2h4' })
      );

    const IconRefresh = (props) =>
      h(
        'svg',
        iconProps(props),
        h('path', { d: 'M13.5 8a5.5 5.5 0 1 1-1.6-3.9' }),
        h('path', { d: 'M13.5 2.5v3.2h-3.2' })
      );

    const IconChevronLeft = (props) => h('svg', iconProps(props), h('path', { d: 'M10 3 5 8l5 5' }));

    const IconChevronDown = (props) => h('svg', iconProps(props), h('path', { d: 'M3.5 6 8 10.5 12.5 6' }));

    const IconCheck = (props) => h('svg', iconProps(props), h('path', { d: 'M3 8.5 6.4 12 13 4.8' }));

    const IconAlert = (props) =>
      h(
        'svg',
        iconProps(props),
        h('path', { d: 'M8 2.2 14.2 13.4H1.8L8 2.2Z' }),
        h('path', { d: 'M8 6.4v3.2' }),
        h('path', { d: 'M8 11.9h.01' })
      );

    const IconX = (props) => h('svg', iconProps(props), h('path', { d: 'M4 4l8 8M12 4l-8 8' }));

    const IconFolder = (props) =>
      h('svg', iconProps(props), h('path', { d: 'M1.8 4.2h4.4l1.4 1.6h6.6v6.6H1.8V4.2Z' }));

    /* ----------------------------------------------------------------- css */

    const STYLE_TEXT = `
.wf-root { display:flex; flex-direction:column; height:100%; min-height:0; overflow:auto;
  background:var(--dsw-alias-bg-base); color:var(--dsw-alias-label-primary); }
.wf-inner { width:100%; max-width:960px; margin:0 auto; padding:26px 28px 56px; box-sizing:border-box; }
.wf-root, .wf-root * { box-sizing:border-box; }
.wf-back { display:inline-flex; align-items:center; gap:5px; border:0; padding:0; margin:0;
  background:transparent; color:var(--dsw-alias-label-secondary); font:inherit; font-size:12.5px;
  cursor:pointer; border-radius:6px; }
.wf-back:hover { color:var(--dsw-alias-label-primary); }
.wf-head { display:flex; align-items:flex-start; justify-content:space-between; gap:20px 28px; flex-wrap:wrap; margin-top:10px; }
.wf-title { margin:0; font-size:22px; font-weight:650; line-height:1.25; letter-spacing:-0.01em; }
.wf-sub { margin:6px 0 0; max-width:62ch; font-size:13px; line-height:1.55; color:var(--dsw-alias-label-secondary); }
.wf-head-actions { display:flex; align-items:center; gap:8px; padding-top:2px; }

.wf-btn { display:inline-flex; align-items:center; gap:6px; border-radius:8px; border:1px solid transparent;
  padding:7px 12px; font:inherit; font-size:13px; font-weight:550; line-height:1.3; cursor:pointer;
  transition:background .15s ease, border-color .15s ease, color .15s ease, opacity .15s ease; }
.wf-btn:disabled { opacity:.5; cursor:default; }
.wf-btn:focus-visible { outline:2px solid var(--dsw-alias-brand-primary); outline-offset:2px; }
.wf-btn-primary { background:var(--dsw-alias-brand-primary); color:var(--dsw-alias-bg-base); }
.wf-btn-primary:hover:not(:disabled) { opacity:.9; }
.wf-btn-secondary { background:var(--dsw-alias-bg-layer-1); border-color:var(--dsw-alias-border-l2); color:var(--dsw-alias-label-primary); }
.wf-btn-secondary:hover:not(:disabled) { background:var(--dsw-alias-bg-layer-2); }
.wf-btn-ghost { background:transparent; color:var(--dsw-alias-label-secondary); }
.wf-btn-ghost:hover:not(:disabled) { background:var(--dsw-alias-bg-layer-2); color:var(--dsw-alias-label-primary); }

.wf-toolbar { display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin:22px 0 14px; }
.wf-search { position:relative; flex:1 1 260px; min-width:190px; }
.wf-search-icon { position:absolute; left:10px; top:50%; transform:translateY(-50%); color:var(--dsw-alias-label-secondary); pointer-events:none; display:flex; }
.wf-search-input { width:100%; height:34px; padding:0 34px 0 32px; border:1px solid var(--dsw-alias-border-l1);
  border-radius:8px; background:var(--dsw-alias-bg-layer-1); color:var(--dsw-alias-label-primary);
  font:inherit; font-size:13px; }
.wf-search-input::placeholder { color:var(--dsw-alias-label-secondary); }
.wf-search-input:focus-visible { outline:2px solid var(--dsw-alias-brand-primary); outline-offset:0; border-color:var(--dsw-alias-brand-primary); }
.wf-search-clear { position:absolute; right:5px; top:50%; transform:translateY(-50%); display:flex; align-items:center;
  justify-content:center; width:24px; height:24px; border:0; border-radius:6px; background:transparent;
  color:var(--dsw-alias-label-secondary); cursor:pointer; }
.wf-search-clear:hover { background:var(--dsw-alias-bg-layer-2); color:var(--dsw-alias-label-primary); }
.wf-search-clear:focus-visible { outline:2px solid var(--dsw-alias-brand-primary); outline-offset:1px; }

.wf-scopes { display:inline-flex; gap:2px; padding:3px; border:1px solid var(--dsw-alias-border-l1);
  border-radius:9px; background:var(--dsw-alias-bg-layer-1); }
.wf-scope-btn { border:0; border-radius:7px; padding:4px 10px; background:transparent; color:var(--dsw-alias-label-secondary);
  font:inherit; font-size:12px; font-weight:550; cursor:pointer; }
.wf-scope-btn:hover { color:var(--dsw-alias-label-primary); }
.wf-scope-btn[aria-pressed="true"] { background:var(--dsw-alias-bg-layer-2); color:var(--dsw-alias-label-primary); }
.wf-scope-btn:focus-visible { outline:2px solid var(--dsw-alias-brand-primary); outline-offset:1px; }

.wf-meta-line { display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin:0 0 10px;
  font-size:12px; color:var(--dsw-alias-label-secondary); }
.wf-meta-dot { width:3px; height:3px; border-radius:50%; background:currentColor; opacity:.7; }
.wf-meta-warn { display:inline-flex; align-items:center; gap:5px; color:var(--dsw-alias-state-warn-primary); }

.wf-list { border:1px solid var(--dsw-alias-border-l1); border-radius:12px; background:var(--dsw-alias-bg-layer-1); overflow:hidden; }
.wf-row + .wf-row { border-top:1px solid var(--dsw-alias-border-l1); }
.wf-row-head { display:flex; align-items:flex-start; gap:12px; width:100%; padding:14px 16px; border:0;
  background:transparent; color:inherit; font:inherit; text-align:left; cursor:pointer; }
.wf-row-head:hover { background:var(--dsw-alias-bg-layer-2); }
.wf-row-head:focus-visible { outline:2px solid var(--dsw-alias-brand-primary); outline-offset:-2px; }
.wf-row-main { flex:1; min-width:0; }
.wf-row-title { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
.wf-mono { font-family:ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
.wf-row-name { font-size:13.5px; font-weight:600; line-height:1.4; word-break:break-word; }
.wf-pill { display:inline-flex; align-items:center; gap:4px; padding:1px 8px; border-radius:999px;
  border:1px solid var(--dsw-alias-border-l1); background:var(--dsw-alias-bg-base);
  color:var(--dsw-alias-label-secondary); font-size:11px; line-height:17px; white-space:nowrap; }
.wf-pill-warn { color:var(--dsw-alias-state-warn-primary); border-color:var(--dsw-alias-state-warn-primary); }
.wf-row-intent { display:block; margin-top:5px; font-size:13px; line-height:1.5; color:var(--dsw-alias-label-primary); overflow-wrap:anywhere; }
.wf-row-meta { display:flex; align-items:center; gap:12px; flex-wrap:wrap; margin-top:7px;
  font-size:12px; color:var(--dsw-alias-label-secondary); }
.wf-chevron { flex:none; margin-top:2px; color:var(--dsw-alias-label-secondary); transition:transform .16s ease; }
.wf-row-head[aria-expanded="true"] .wf-chevron { transform:rotate(180deg); }

.wf-detail { padding:2px 16px 18px 16px; }
.wf-detail-grid { display:grid; grid-template-columns:112px minmax(0,1fr); gap:9px 18px;
  padding-top:14px; border-top:1px solid var(--dsw-alias-border-l1); font-size:12.5px; line-height:1.55; }
.wf-detail-pair { display:contents; }
.wf-detail-label { color:var(--dsw-alias-label-secondary); }
.wf-detail-value { min-width:0; color:var(--dsw-alias-label-primary); overflow-wrap:anywhere; }
.wf-chips { display:flex; gap:6px; flex-wrap:wrap; }
.wf-input-chip { display:inline-flex; align-items:baseline; gap:5px; padding:2px 8px; border-radius:6px;
  border:1px solid var(--dsw-alias-border-l1); background:var(--dsw-alias-bg-base); font-family:ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size:11.5px; }
.wf-input-type { color:var(--dsw-alias-label-secondary); font-size:10.5px; }
.wf-input-req { color:var(--dsw-alias-state-error-primary); }
.wf-tag { display:inline-flex; padding:1px 7px; border-radius:6px; background:var(--dsw-alias-bg-layer-2);
  color:var(--dsw-alias-label-secondary); font-size:11.5px; }
.wf-shadow { display:inline-flex; align-items:center; gap:6px; color:var(--dsw-alias-state-warn-primary); font-size:12px; }

.wf-empty { border:1px dashed var(--dsw-alias-border-l2); border-radius:12px; padding:38px 26px; text-align:center; }
.wf-empty-icon { display:inline-flex; color:var(--dsw-alias-brand-primary); margin-bottom:10px; }
.wf-empty-title { margin:0 0 6px; font-size:15px; font-weight:600; }
.wf-empty-body { margin:0 auto 16px; max-width:52ch; font-size:13px; line-height:1.6; color:var(--dsw-alias-label-secondary); }
.wf-empty-small { border:0; padding:26px 20px; }
.wf-empty-actions { display:flex; align-items:center; justify-content:center; gap:8px; flex-wrap:wrap; }
.wf-btn-sm { padding:5px 9px; font-size:12px; }
.wf-detail-actions { display:flex; justify-content:flex-end; padding-top:12px; }
.wf-form-meta { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }

.wf-skeleton-row { display:flex; align-items:flex-start; gap:12px; padding:15px 16px; }
.wf-skeleton-row + .wf-skeleton-row { border-top:1px solid var(--dsw-alias-border-l1); }
.wf-skeleton { border-radius:5px; background:var(--dsw-alias-bg-layer-2); animation:wf-pulse 1.4s ease-in-out infinite; }
.wf-skeleton-title { width:31%; height:13px; margin-bottom:8px; }
.wf-skeleton-intent { width:68%; height:11px; margin-bottom:7px; }
.wf-skeleton-meta { width:22%; height:9px; }
@keyframes wf-pulse { 0%,100% { opacity:1; } 50% { opacity:.45; } }

.wf-banner { display:flex; align-items:flex-start; gap:9px; margin:0 0 14px; padding:10px 12px;
  border-radius:8px; border:1px solid var(--dsw-alias-border-l1); background:var(--dsw-alias-bg-layer-1);
  font-size:12.5px; line-height:1.5; }
.wf-banner-icon { flex:none; margin-top:1px; }
.wf-banner-success { color:var(--dsw-alias-state-success-primary); }
.wf-banner-error { color:var(--dsw-alias-state-error-primary); border-color:var(--dsw-alias-state-error-primary); }
.wf-banner-text { color:var(--dsw-alias-label-primary); flex:1; min-width:0; }
.wf-banner-error .wf-banner-text { color:var(--dsw-alias-state-error-primary); white-space:pre-wrap; overflow-wrap:anywhere; }
.wf-banner-action { margin-top:8px; }

.wf-problems { margin-top:24px; }
.wf-problem-head { display:flex; align-items:center; gap:7px; margin-bottom:8px; font-size:12.5px; font-weight:600; }
.wf-problem-head svg { color:var(--dsw-alias-state-warn-primary); }
.wf-problem-hint { margin: -4px 0 10px; font-size:11.5px; color:var(--dsw-alias-label-secondary); }
.wf-problem-row { padding:11px 13px; }
.wf-problem-row + .wf-problem-row { border-top:1px solid var(--dsw-alias-border-l1); }
.wf-problem-name { font-size:12.5px; font-weight:600; }
.wf-problem-path { margin-top:3px; font-size:11px; color:var(--dsw-alias-label-secondary); overflow-wrap:anywhere; }
.wf-problem-error { margin-top:5px; font-size:12px; color:var(--dsw-alias-state-error-primary); white-space:pre-wrap; overflow-wrap:anywhere; }

.wf-dirs { margin-top:26px; }
.wf-dirs summary { display:inline-flex; align-items:center; gap:6px; cursor:pointer; font-size:12.5px;
  font-weight:550; color:var(--dsw-alias-label-secondary); border-radius:6px; }
.wf-dirs summary:hover { color:var(--dsw-alias-label-primary); }
.wf-dirs summary:focus-visible { outline:2px solid var(--dsw-alias-brand-primary); outline-offset:3px; }
.wf-dir-row { display:flex; align-items:flex-start; gap:8px; margin-top:7px; font-size:11.5px;
  color:var(--dsw-alias-label-secondary); }
.wf-dir-mark { flex:none; display:flex; margin-top:1px; }
.wf-dir-mark-ok { color:var(--dsw-alias-state-success-primary); }
.wf-dir-mark-off { color:var(--dsw-alias-label-secondary); opacity:.6; }
.wf-dir-scope { flex:none; width:58px; color:var(--dsw-alias-label-primary); }
.wf-dir-path { min-width:0; overflow-wrap:anywhere; font-family:ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }

.wf-form { margin-top:20px; border:1px solid var(--dsw-alias-border-l1); border-radius:12px;
  background:var(--dsw-alias-bg-layer-1); overflow:hidden; }
.wf-form-head { display:flex; align-items:baseline; justify-content:space-between; gap:10px 18px; flex-wrap:wrap;
  padding:16px 20px; border-bottom:1px solid var(--dsw-alias-border-l1); }
.wf-form-title { margin:0; font-size:15px; font-weight:600; }
.wf-form-note { font-size:11.5px; color:var(--dsw-alias-label-secondary); }
.wf-form-body { display:flex; flex-direction:column; gap:16px; padding:18px 20px 20px; }
.wf-field { display:flex; flex-direction:column; gap:5px; }
.wf-label { display:flex; align-items:baseline; gap:4px; font-size:12.5px; font-weight:600; }
.wf-req { color:var(--dsw-alias-state-error-primary); font-weight:500; }
.wf-hint { font-size:11.5px; line-height:1.5; color:var(--dsw-alias-label-secondary); }
.wf-input, .wf-textarea { width:100%; border:1px solid var(--dsw-alias-border-l1); border-radius:8px;
  background:var(--dsw-alias-bg-base); color:var(--dsw-alias-label-primary); font:inherit; font-size:13px; }
.wf-input { height:34px; padding:0 10px; }
.wf-textarea { padding:10px; min-height:196px; resize:vertical; font-family:ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size:12.5px; line-height:1.6; }
.wf-input:focus-visible, .wf-textarea:focus-visible { outline:2px solid var(--dsw-alias-brand-primary); outline-offset:0;
  border-color:var(--dsw-alias-brand-primary); }
.wf-input[aria-invalid="true"], .wf-textarea[aria-invalid="true"] { border-color:var(--dsw-alias-state-error-primary); }
.wf-field-error { font-size:11.5px; color:var(--dsw-alias-state-error-primary); }
.wf-check-row { display:flex; align-items:flex-start; gap:8px; font-size:12.5px; line-height:1.5; }
.wf-check-row input { margin-top:2px; accent-color:var(--dsw-alias-brand-primary); }
.wf-form-foot { display:flex; align-items:center; justify-content:space-between; gap:10px 16px; flex-wrap:wrap;
  padding:13px 20px; border-top:1px solid var(--dsw-alias-border-l1); background:var(--dsw-alias-bg-base); }
.wf-form-count { font-size:11.5px; color:var(--dsw-alias-label-secondary); }
.wf-form-actions { display:flex; align-items:center; gap:8px; }

@media (max-width: 720px) {
  .wf-inner { padding:20px 16px 40px; }
  .wf-head-actions { width:100%; }
  .wf-head-actions .wf-btn-primary { flex:1; justify-content:center; }
  .wf-detail-grid { grid-template-columns:1fr; gap:3px 0; }
  .wf-detail-grid .wf-detail-label { margin-top:7px; }
  .wf-dir-scope { width:auto; }
}
`;

    /* ------------------------------------------------------------ components */

    function scopeLabel(t, scope) {
      if (scope === 'builtin') return t('scopeBuiltin');
      if (scope === 'project') return t('scopeProject');
      if (scope === 'personal') return t('scopePersonal');
      return String(scope ?? '');
    }

    function Pill({ children, warn }) {
      return h('span', { className: warn ? 'wf-pill wf-pill-warn' : 'wf-pill' }, children);
    }

    const README_PATH = 'plugins/workflow-kit/README.md';
    const EXAMPLES_PATH = 'plugins/workflow-kit/workflows/';

    function trimmed(value) {
      return String(value ?? '').trim();
    }

    function creationSeed(draft) {
      const lines = [];
      lines.push('You are helping me create a DSH workflow capsule (dsh.workflow v1) for this workspace.');
      lines.push('');
      lines.push(`Read ${README_PATH} and the examples in ${EXAMPLES_PATH} first so you use the real format.`);
      lines.push('');
      lines.push('Then interview me, one or two questions at a time, to pin down:');
      lines.push('1. name — kebab-case, max 64 characters');
      lines.push('2. intent — one sentence describing what the workflow achieves');
      lines.push('3. whenToUse — when I should use it instead of plain chat');
      lines.push('4. inputs — name, type (string|number|integer|boolean|array|object), required, default, description');
      lines.push(
        '5. script — a plain function body, NOT a module (no import/export): args, agent(), pipeline(), parallel(), phase() and log() are in scope, and the body must end with `return <json-serializable value>`.'
      );
      const draftLines = [];
      if (trimmed(draft?.name)) draftLines.push(`- name: ${trimmed(draft.name)}`);
      if (trimmed(draft?.intent)) draftLines.push(`- intent: ${trimmed(draft.intent)}`);
      if (trimmed(draft?.whenToUse)) draftLines.push(`- when to use: ${trimmed(draft.whenToUse)}`);
      if (trimmed(draft?.script)) {
        const body = trimmed(draft.script)
          .split('\n')
          .map((line) => `    ${line}`)
          .join('\n');
        draftLines.push(`- body I sketched:\n${body}`);
      }
      if (draftLines.length > 0) {
        lines.push('');
        lines.push('I already started a draft in the panel:');
        lines.push(...draftLines);
      }
      lines.push('');
      lines.push(
        'Draft the capsule and show me the script before saving. Keep it small, concrete and grounded in this repository. When I approve, save it with the workflow_save tool (personal scope unless I ask for project) and show me the saved path. After saving, stay with me for improvements.'
      );
      lines.push('');
      lines.push('Start by confirming what the workflow should do, and offer 2-3 concrete ideas based on this repository.');
      return lines.join('\n');
    }

    function improvementSeed(workflow) {
      const name = String(workflow?.name ?? '');
      const scope = String(workflow?.scope ?? 'personal');
      const path = String(workflow?.path ?? '');
      return [
        `I want to improve an existing workflow capsule: \`${name}\` (scope: ${scope}${path ? `, path: ${path}` : ''}).`,
        '',
        'Read it with the workflow_show tool first. Then ask me what I want to change.',
        'Keep its name and intent unless I ask otherwise. Show the updated script before saving, and save with workflow_save (same name and scope) only after I confirm. Finish by summarizing what changed.'
      ].join('\n');
    }

    function DetailRow({ id, label, children }) {
      return h(
        'div',
        { key: id, className: 'wf-detail-pair' },
        h('div', { className: 'wf-detail-label' }, label),
        h('div', { className: 'wf-detail-value' }, children)
      );
    }

    function CapsuleRow({ workflow, open, onToggle, onImprove, chatReady, t }) {
      const inputs = Array.isArray(workflow.inputs) ? workflow.inputs : [];
      const phases = Array.isArray(workflow.phases) ? workflow.phases : [];
      const tags = Array.isArray(workflow.tags) ? workflow.tags : [];
      const shadowed = workflow.alsoIn !== undefined && workflow.alsoIn !== null && String(workflow.alsoIn) !== '';
      const meta = [];
      meta.push(`${inputs.length} ${t('inputsCount')}`);
      if (phases.length > 0) meta.push(`${phases.length} ${t('phasesCount')}`);
      if (tags.length > 0) meta.push(`${tags.length} ${t('tagsCount')}`);

      const rows = [];
      if (workflow.whenToUse) rows.push(DetailRow({ id: 'when', label: t('whenLabel'), children: workflow.whenToUse }));
      if (inputs.length > 0) {
        rows.push(
          DetailRow({
            id: 'inputs',
            label: t('inputsLabel'),
            children: h(
              'div',
              { className: 'wf-chips' },
              inputs.map((input, index) =>
                h(
                  'span',
                  { key: `${input.name}:${index}`, className: 'wf-input-chip' },
                  h('span', null, input.name),
                  h('span', { className: 'wf-input-type' }, String(input.type ?? 'string')),
                  input.required === true ? h('span', { className: 'wf-input-req', title: t('required') }, '*') : null
                )
              )
            )
          })
        );
      }
      if (phases.length > 0) {
        rows.push(
          DetailRow({
            id: 'phases',
            label: t('phasesLabel'),
            children: phases.map((phase) => phase?.title).filter(Boolean).join(' → ')
          })
        );
      }
      if (tags.length > 0) {
        rows.push(
          DetailRow({
            id: 'tags',
            label: t('tagsLabel'),
            children: h(
              'div',
              { className: 'wf-chips' },
              tags.map((tag) => h('span', { key: tag, className: 'wf-tag' }, tag))
            )
          })
        );
      }
      if (workflow.path) rows.push(DetailRow({ id: 'path', label: t('pathLabel'), children: workflow.path }));
      if (shadowed) {
        rows.push(
          DetailRow({
            id: 'shadow',
            label: t('shadowLabel'),
            children: h(
              'span',
              { className: 'wf-shadow' },
              h(IconAlert, { size: 13 }),
              `${String(workflow.alsoIn)} — ${t('shadowHint')}`
            )
          })
        );
      }

      return h(
        'div',
        { className: 'wf-row' },
        h(
          'button',
          {
            type: 'button',
            className: 'wf-row-head',
            'aria-expanded': open === true,
            'aria-label': `${workflow.name} — ${open ? t('hideDetails') : t('showDetails')}`,
            onClick: onToggle
          },
          h(
            'span',
            { className: 'wf-row-main' },
            h(
              'span',
              { className: 'wf-row-title' },
              h('span', { className: 'wf-mono wf-row-name' }, workflow.name),
              workflow.scope ? h(Pill, null, scopeLabel(t, workflow.scope)) : null,
              shadowed ? h(Pill, { warn: true }, t('shadowLabel')) : null
            ),
            workflow.intent ? h('span', { className: 'wf-row-intent' }, workflow.intent) : null,
            h(
              'span',
              { className: 'wf-row-meta' },
              meta.map((entry, index) => [
                index > 0 ? h('span', { key: `d${index}`, className: 'wf-meta-dot', 'aria-hidden': true }) : null,
                h('span', { key: `m${index}` }, entry)
              ])
            )
          ),
          h('span', { className: 'wf-chevron', 'aria-hidden': true }, h(IconChevronDown))
        ),
        open === true
          ? h(
              'div',
              { className: 'wf-detail' },
              h('div', { className: 'wf-detail-grid' }, rows),
              chatReady
                ? h(
                    'div',
                    { className: 'wf-detail-actions' },
                    h(
                      'button',
                      {
                        type: 'button',
                        className: 'wf-btn wf-btn-secondary wf-btn-sm',
                        onClick: onImprove,
                        title: t('chatImproveHint')
                      },
                      h(IconChat, { size: 14 }),
                      t('chatImprove')
                    )
                  )
                : null
            )
          : null
      );
    }

    function SkeletonList({ t }) {
      return h(
        'div',
        { className: 'wf-list', 'aria-label': t('loadingAria'), 'aria-busy': 'true' },
        [0, 1, 2].map((index) =>
          h(
            'div',
            { key: index, className: 'wf-skeleton-row' },
            h(
              'div',
              { style: { flex: 1 } },
              h('div', { className: 'wf-skeleton wf-skeleton-title' }),
              h('div', { className: 'wf-skeleton wf-skeleton-intent' }),
              h('div', { className: 'wf-skeleton wf-skeleton-meta' })
            )
          )
        )
      );
    }

    function EmptyState({ t, onCreate, onCreateWithChat, chatReady, small, query, onClearFilters }) {
      if (small) {
        return h(
          'div',
          { className: 'wf-empty wf-empty-small' },
          h('p', { style: { margin: 0, fontSize: 13, color: 'var(--dsw-alias-label-secondary)' } }, t('noMatches')),
          h(
            'div',
            { style: { marginTop: 12 } },
            h('button', { type: 'button', className: 'wf-btn wf-btn-secondary', onClick: onClearFilters }, t('clearFilters'))
          )
        );
      }
      return h(
        'div',
        { className: 'wf-empty' },
        h('span', { className: 'wf-empty-icon' }, h(FlowIcon, { size: 28 })),
        h('h2', { className: 'wf-empty-title' }, t('emptyTitle')),
        h('p', { className: 'wf-empty-body' }, t('emptyBody')),
        h(
          'div',
          { className: 'wf-empty-actions' },
          chatReady
            ? h(
                'button',
                {
                  type: 'button',
                  className: 'wf-btn wf-btn-primary',
                  onClick: onCreateWithChat,
                  title: t('chatCreateHint')
                },
                h(IconChat),
                t('chatCreate')
              )
            : null,
          h(
            'button',
            {
              type: 'button',
              className: chatReady ? 'wf-btn wf-btn-secondary' : 'wf-btn wf-btn-primary',
              onClick: onCreate
            },
            h(IconPlus),
            t('newWorkflow')
          )
        )
      );
    }

    function DirsFooter({ dirs, t }) {
      if (!Array.isArray(dirs) || dirs.length === 0) return null;
      return h(
        'details',
        { className: 'wf-dirs' },
        h(
          'summary',
          null,
          h(IconFolder, { size: 14 }),
          `${t('searchDirs')} (${dirs.length})`
        ),
        dirs.map((entry) =>
          h(
            'div',
            { key: entry.dir, className: 'wf-dir-row' },
            h(
              'span',
              { className: entry.exists ? 'wf-dir-mark wf-dir-mark-ok' : 'wf-dir-mark wf-dir-mark-off' },
              entry.exists ? h(IconCheck, { size: 12 }) : h(IconChevronDown, { size: 12 })
            ),
            h('span', { className: 'wf-dir-scope' }, scopeLabel(t, entry.scope) || entry.scope),
            h('span', { className: 'wf-dir-path' }, entry.dir),
            entry.exists ? null : h('span', { style: { flex: 'none' } }, t('dirMissing'))
          )
        )
      );
    }

    function WorkflowPanelPage(props) {
      const t = props.t;
      const callRemote = props.callRemote;
      const close = props.close;
      const openChat = props.openChat;
      const chatReady = typeof openChat === 'function';

      const [state, setState] = useState({ status: 'loading', data: null, error: '' });
      const [notice, setNotice] = useState('');
      const [chatError, setChatError] = useState('');
      const [form, setForm] = useState(null);
      const [saving, setSaving] = useState(false);
      const [formError, setFormError] = useState('');
      const [fieldErrors, setFieldErrors] = useState({});
      const [query, setQuery] = useState('');
      const [scopeFilter, setScopeFilter] = useState('all');
      const [openName, setOpenName] = useState('');
      const nameRef = useRef(null);

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

      useEffect(() => {
        if (form && nameRef.current) nameRef.current.focus();
      }, [form !== null]);

      useEffect(() => {
        if (!form) return undefined;
        const onKeyDown = (event) => {
          if (event.key === 'Escape' && !saving) {
            setForm(null);
            setFormError('');
            setFieldErrors({});
          }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
      }, [form, saving]);

      const openForm = () => {
        setNotice('');
        setFormError('');
        setFieldErrors({});
        setForm({ name: '', intent: '', whenToUse: '', script: '', overwrite: false });
      };
      const closeForm = () => {
        if (saving) return;
        setForm(null);
        setFormError('');
        setFieldErrors({});
      };
      const createWithChat = (draft) => {
        if (!chatReady) return;
        try {
          openChat(creationSeed(draft));
          setChatError('');
        } catch (error) {
          setChatError(error instanceof Error ? error.message : String(error));
        }
      };
      const improveWithChat = (workflow) => {
        if (!chatReady) return;
        try {
          openChat(improvementSeed(workflow));
          setChatError('');
        } catch (error) {
          setChatError(error instanceof Error ? error.message : String(error));
        }
      };

      const setField = (key) => (event) => {
        const value = event?.target?.type === 'checkbox' ? event.target.checked : event.target.value;
        setForm((current) => (current ? { ...current, [key]: value } : current));
        setFieldErrors((current) => {
          if (!current || current[key] === undefined) return current;
          const next = { ...current };
          delete next[key];
          return next;
        });
      };

      const validate = (draft) => {
        const errors = {};
        const name = String(draft.name ?? '').trim();
        if (name === '') errors.name = t('required');
        else if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(name)) errors.name = t('nameInvalid');
        if (String(draft.intent ?? '').trim() === '') errors.intent = t('required');
        const script = String(draft.script ?? '');
        if (script.trim() === '') errors.script = t('required');
        else if (/^[ \t]*(import|export)\s/m.test(script)) errors.script = t('scriptEsm');
        return errors;
      };

      const submit = async (event) => {
        event.preventDefault();
        if (!form || saving) return;
        const errors = validate(form);
        setFieldErrors(errors);
        if (Object.keys(errors).length > 0) return;
        setSaving(true);
        setFormError('');
        try {
          const saved = await callRemote('save', [
            {
              name: String(form.name).trim(),
              intent: String(form.intent).trim(),
              whenToUse: String(form.whenToUse ?? '').trim(),
              script: form.script,
              overwrite: form.overwrite === true
            }
          ]);
          setNotice(`${t('saved')}: ${saved?.name ?? form.name}`);
          setForm(null);
          setFieldErrors({});
          await refresh();
        } catch (error) {
          setFormError(error instanceof Error ? error.message : String(error));
        } finally {
          setSaving(false);
        }
      };

      const data = state.data ?? {};
      const workflows = Array.isArray(data.workflows) ? data.workflows : [];
      const problems = Array.isArray(data.problems) ? data.problems : [];
      const dirs = Array.isArray(data.dirs) ? data.dirs : [];

      const scopeCounts = useMemo(() => {
        const counts = {};
        for (const workflow of workflows) {
          const key = String(workflow.scope ?? 'unknown');
          counts[key] = (counts[key] ?? 0) + 1;
        }
        return counts;
      }, [workflows]);

      const scopeKeys = useMemo(() => {
        const order = { builtin: 0, project: 1, personal: 2 };
        return Object.keys(scopeCounts).sort((a, b) => (order[a] ?? 9) - (order[b] ?? 9) || a.localeCompare(b));
      }, [scopeCounts]);

      const filtered = useMemo(() => {
        const needle = query.trim().toLowerCase();
        const rank = { builtin: 0, project: 1, personal: 2 };
        return workflows
          .filter((workflow) => scopeFilter === 'all' || String(workflow.scope) === scopeFilter)
          .filter((workflow) => {
            if (needle === '') return true;
            const haystack = [workflow.name, workflow.intent, workflow.whenToUse, workflow.path]
              .concat(Array.isArray(workflow.tags) ? workflow.tags : [])
              .map((value) => String(value ?? '').toLowerCase())
              .join('\n');
            return haystack.includes(needle);
          })
          .slice()
          .sort((a, b) => (rank[a.scope] ?? 9) - (rank[b.scope] ?? 9) || String(a.name).localeCompare(String(b.name)));
      }, [workflows, query, scopeFilter]);

      const hasFilter = query.trim() !== '' || scopeFilter !== 'all';
      let main;

      if (state.status === 'loading') {
        main = h(SkeletonList, { t });
      } else if (state.status === 'error') {
        main = h(
          'div',
          { className: 'wf-banner wf-banner-error', role: 'alert' },
          h('span', { className: 'wf-banner-icon' }, h(IconAlert, { size: 15 })),
          h(
            'div',
            { className: 'wf-banner-text' },
            `${t('loadFailed')}\n${state.error}`,
            h(
              'div',
              { className: 'wf-banner-action' },
              h('button', { type: 'button', className: 'wf-btn wf-btn-secondary', onClick: () => void refresh() }, t('retry'))
            )
          )
        );
      } else if (workflows.length === 0) {
        main = h(EmptyState, {
          t,
          onCreate: openForm,
          onCreateWithChat: () => createWithChat(null),
          chatReady
        });
      } else if (filtered.length === 0) {
        main = h(EmptyState, {
          t,
          small: true,
          onClearFilters: () => {
            setQuery('');
            setScopeFilter('all');
          }
        });
      } else {
        main = h(
          'div',
          null,
          h(
            'div',
            { className: 'wf-list' },
            filtered.map((workflow) =>
              h(CapsuleRow, {
                key: `${workflow.scope}:${workflow.path}:${workflow.name}`,
                workflow,
                chatReady,
                onImprove: () => improveWithChat(workflow),
                t,
                open: openName === `${workflow.scope}:${workflow.path}:${workflow.name}`,
                onToggle: () => {
                  const id = `${workflow.scope}:${workflow.path}:${workflow.name}`;
                  setOpenName((current) => (current === id ? '' : id));
                }
              })
            )
          )
        );
      }

      const countText =
        hasFilter && state.status === 'ready'
          ? `${filtered.length} ${t('countMatches')} · ${workflows.length} ${t('countCapsules')}`
          : `${workflows.length} ${t('countCapsules')}`;

      return h(
        'div',
        { className: 'wf-root' },
        h('style', { dangerouslySetInnerHTML: { __html: STYLE_TEXT } }),
        h(
          'div',
          { className: 'wf-inner' },
          h(
            'button',
            { type: 'button', className: 'wf-back', onClick: close },
            h(IconChevronLeft),
            t('back')
          ),
          h(
            'div',
            { className: 'wf-head' },
            h(
              'div',
              null,
              h('h1', { className: 'wf-title' }, t('panelTitle')),
              h('p', { className: 'wf-sub' }, t('subtitle'))
            ),
            form
              ? null
              : h(
                  'div',
                  { className: 'wf-head-actions' },
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'wf-btn wf-btn-secondary',
                      onClick: () => void refresh(),
                      disabled: state.status === 'loading' || state.status === 'refreshing'
                    },
                    h(IconRefresh),
                    t('refresh')
                  ),
                  chatReady
                    ? h(
                        'button',
                        {
                          type: 'button',
                          className: 'wf-btn wf-btn-secondary',
                          onClick: () => createWithChat(null),
                          title: t('chatCreateHint')
                        },
                        h(IconChat),
                        t('chatCreate')
                      )
                    : null,
                  h(
                    'button',
                    { type: 'button', className: 'wf-btn wf-btn-primary', onClick: openForm },
                    h(IconPlus),
                    t('newWorkflow')
                  )
                )
          ),
          notice && !form
            ? h(
                'div',
                { className: 'wf-banner wf-banner-success', role: 'status', style: { marginTop: 18 } },
                h('span', { className: 'wf-banner-icon' }, h(IconCheck, { size: 15 })),
                h('span', { className: 'wf-banner-text' }, notice)
              )
            : null,
          chatError
            ? h(
                'div',
                { className: 'wf-banner wf-banner-error', role: 'alert', style: { marginTop: 18 } },
                h('span', { className: 'wf-banner-icon' }, h(IconAlert, { size: 15 })),
                h('span', { className: 'wf-banner-text' }, `${t('chatUnavailable')}\n${chatError}`)
              )
            : null,
          form ? renderForm() : renderList()
        )
      );

      function renderList() {
        return h(
          'div',
          null,
          state.status === 'ready' && workflows.length > 0
            ? h(
                'div',
                { className: 'wf-toolbar' },
            h(
              'div',
              { className: 'wf-search' },
              h('span', { className: 'wf-search-icon' }, h(IconSearch, { size: 14 })),
              h('input', {
                className: 'wf-search-input',
                type: 'text',
                value: query,
                placeholder: t('searchPlaceholder'),
                'aria-label': t('searchLabel'),
                onChange: (event) => setQuery(event.target.value)
              }),
              query !== ''
                ? h(
                    'button',
                    {
                      type: 'button',
                      className: 'wf-search-clear',
                      'aria-label': t('clearSearch'),
                      title: t('clearSearch'),
                      onClick: () => setQuery('')
                    },
                    h(IconX, { size: 12 })
                  )
                : null
            ),
            scopeKeys.length > 1
              ? h(
                  'div',
                  { className: 'wf-scopes', role: 'group', 'aria-label': t('scopeFilter') },
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'wf-scope-btn',
                      'aria-pressed': scopeFilter === 'all',
                      onClick: () => setScopeFilter('all')
                    },
                    `${t('allScopes')} ${workflows.length}`
                  ),
                  scopeKeys.map((scope) =>
                    h(
                      'button',
                      {
                        type: 'button',
                        key: scope,
                        className: 'wf-scope-btn',
                        'aria-pressed': scopeFilter === scope,
                        onClick: () => setScopeFilter(scope)
                      },
                      `${scopeLabel(t, scope) || scope} ${scopeCounts[scope]}`
                    )
                  )
                )
              : null
              )
            : null,
          state.status === 'ready'
            ? h(
                'div',
                { className: 'wf-meta-line' },
                h('span', null, countText),
                problems.length > 0
                  ? [
                      h('span', { key: 'dot', className: 'wf-meta-dot' }),
                      h(
                        'span',
                        { key: 'warn', className: 'wf-meta-warn' },
                        h(IconAlert, { size: 12 }),
                        `${problems.length} ${t('problems').toLowerCase()}`
                      )
                    ]
                  : null
              )
            : null,
          main,
          state.status === 'ready' && problems.length > 0
            ? h(
                'div',
                { className: 'wf-problems' },
                h(
                  'div',
                  { className: 'wf-problem-head' },
                  h(IconAlert, { size: 14 }),
                  `${t('problems')} (${problems.length})`
                ),
                h('p', { className: 'wf-problem-hint' }, t('problemsHint')),
                h(
                  'div',
                  { className: 'wf-list' },
                  problems.map((problem) =>
                    h(
                      'div',
                      { key: `${problem.scope}:${problem.path}`, className: 'wf-problem-row' },
                      h('div', { className: 'wf-problem-name wf-mono' }, problem.name),
                      problem.path ? h('div', { className: 'wf-problem-path wf-mono' }, problem.path) : null,
                      problem.error ? h('div', { className: 'wf-problem-error' }, problem.error) : null
                    )
                  )
                )
              )
            : null,
          state.status === 'ready' ? h(DirsFooter, { dirs, t }) : null
        );
      }

      function renderForm() {
        const scriptLength = String(form.script ?? '').length;
        return h(
          'form',
          { className: 'wf-form', onSubmit: submit, noValidate: true },
          h(
            'div',
            { className: 'wf-form-head' },
            h('h2', { className: 'wf-form-title' }, t('formTitle')),
            h(
              'div',
              { className: 'wf-form-meta' },
              h('span', { className: 'wf-form-note' }, t('formNote')),
              chatReady
                ? h(
                    'button',
                    {
                      type: 'button',
                      className: 'wf-btn wf-btn-ghost wf-btn-sm',
                      onClick: () => createWithChat(form)
                    },
                    h(IconChat, { size: 14 }),
                    t('orCreateWithChat')
                  )
                : null
            )
          ),
          h(
            'div',
            { className: 'wf-form-body' },
            h(
              'label',
              { className: 'wf-field' },
              h('span', { className: 'wf-label' }, `${t('name')} `, h('span', { className: 'wf-req' }, '*')),
              h('span', { className: 'wf-hint' }, t('nameHint')),
              h('input', {
                ref: nameRef,
                className: 'wf-input wf-mono',
                value: form.name,
                placeholder: t('namePlaceholder'),
                'aria-invalid': fieldErrors.name ? 'true' : 'false',
                onChange: setField('name')
              }),
              fieldErrors.name ? h('span', { className: 'wf-field-error', role: 'alert' }, fieldErrors.name) : null
            ),
            h(
              'label',
              { className: 'wf-field' },
              h('span', { className: 'wf-label' }, `${t('intent')} `, h('span', { className: 'wf-req' }, '*')),
              h('span', { className: 'wf-hint' }, t('intentHint')),
              h('input', {
                className: 'wf-input',
                value: form.intent,
                placeholder: t('intentPlaceholder'),
                'aria-invalid': fieldErrors.intent ? 'true' : 'false',
                onChange: setField('intent')
              }),
              fieldErrors.intent ? h('span', { className: 'wf-field-error', role: 'alert' }, fieldErrors.intent) : null
            ),
            h(
              'label',
              { className: 'wf-field' },
              h('span', { className: 'wf-label' }, t('whenToUse')),
              h('span', { className: 'wf-hint' }, t('whenToUseHint')),
              h('input', { className: 'wf-input', value: form.whenToUse, onChange: setField('whenToUse') })
            ),
            h(
              'label',
              { className: 'wf-field' },
              h('span', { className: 'wf-label' }, `${t('body')} `, h('span', { className: 'wf-req' }, '*')),
              h('span', { className: 'wf-hint' }, t('bodyHint')),
              h('textarea', {
                className: 'wf-textarea',
                rows: 12,
                value: form.script,
                placeholder: t('bodyPlaceholder'),
                spellCheck: false,
                'aria-invalid': fieldErrors.script ? 'true' : 'false',
                onChange: setField('script')
              }),
              h('span', { className: 'wf-hint' }, t('bodyNote')),
              fieldErrors.script ? h('span', { className: 'wf-field-error', role: 'alert' }, fieldErrors.script) : null
            ),
            h(
              'label',
              { className: 'wf-check-row' },
              h('input', { type: 'checkbox', checked: form.overwrite, onChange: setField('overwrite') }),
              h('span', null, t('overwrite'))
            ),
            formError
              ? h(
                  'div',
                  { className: 'wf-banner wf-banner-error', role: 'alert', style: { margin: 0 } },
                  h('span', { className: 'wf-banner-icon' }, h(IconAlert, { size: 15 })),
                  h('span', { className: 'wf-banner-text' }, `${t('saveFailed')}\n${formError}`)
                )
              : null
          ),
          h(
            'div',
            { className: 'wf-form-foot' },
            h('span', { className: 'wf-form-count' }, `${scriptLength} ${t('chars')}`),
            h(
              'div',
              { className: 'wf-form-actions' },
              h('button', { type: 'button', className: 'wf-btn wf-btn-ghost', onClick: closeForm, disabled: saving }, t('cancel')),
              h(
                'button',
                { type: 'submit', className: 'wf-btn wf-btn-primary', disabled: saving },
                saving ? t('saving') : t('save')
              )
            )
          )
        );
      }
    }

    /* -------------------------------------------------------------- register */

    return {
      inject: ['slots', 'locale', 'remote', 'layout', 'uiWorkspace'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, DICTS), 'workflow-kit: panel strings');
        const t = ctx.locale.bind(NS);

        const uiWorkspace = ctx.uiWorkspace;
        const openChat = (seed) => {
          if (!uiWorkspace || typeof uiWorkspace.startSession !== 'function') {
            throw new Error('uiWorkspace.startSession is unavailable');
          }
          uiWorkspace.startSession(undefined, { prompt: seed, whenDraftExists: 'replace' });
        };

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

        const Page = () => h(WorkflowPanelPage, { t, callRemote, close, openChat });

        ctx.slots.inject('sidebar.panellist', () =>
          ctx.slots.register(
            {
              name: 'sidebar.panellist',
              id: PANEL_ID,
              order: 40,
              label: () => t('panelTitle'),
              locale: NS
            },
            function SidebarIcon(props) {
              return h(FlowIcon, { size: props?.size });
            }
          )
        );

        ctx.slots.register({ name: 'main', key: PANEL_ID, locale: NS }, Page);
      }
    };
  }
});
