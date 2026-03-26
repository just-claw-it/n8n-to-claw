import type { NodeCategory, TriggerType } from "../ir/types.js";

// ---------------------------------------------------------------------------
// Exact node-type → category map.
// Source: n8n-io/n8n packages/nodes-base/package.json (v2.13)
//         + @n8n/n8n-nodes-langchain package
//
// Organized by category for maintainability. When n8n adds a new node,
// add it here. If you forget, the suffix/prefix fallbacks below will
// still produce a reasonable default.
// ---------------------------------------------------------------------------

const EXACT_MAP: Record<string, NodeCategory> = {
  // ── Triggers ────────────────────────────────────────────────────────────
  "n8n-nodes-base.manualTrigger": "trigger",
  "n8n-nodes-base.scheduleTrigger": "trigger",
  "n8n-nodes-base.cronTrigger": "trigger",
  "n8n-nodes-base.cron": "trigger",
  "n8n-nodes-base.intervalTrigger": "trigger",
  "n8n-nodes-base.interval": "trigger",
  "n8n-nodes-base.start": "trigger",
  "n8n-nodes-base.errorTrigger": "trigger",
  "n8n-nodes-base.n8nTrigger": "trigger",
  "n8n-nodes-base.workflowTrigger": "trigger",
  "n8n-nodes-base.executeWorkflowTrigger": "trigger",
  "n8n-nodes-base.emailTrigger": "trigger",
  "n8n-nodes-base.kafkaTrigger": "trigger",
  "n8n-nodes-base.rabbitMqTrigger": "trigger",
  "n8n-nodes-base.redisTrigger": "trigger",
  "n8n-nodes-base.localFileTrigger": "trigger",
  "n8n-nodes-base.sshTrigger": "trigger",
  "n8n-nodes-base.amqpTrigger": "trigger",
  "n8n-nodes-base.mqttTrigger": "trigger",
  "n8n-nodes-base.sseTrigger": "trigger",
  "n8n-nodes-base.simulateTrigger": "trigger",
  "n8n-nodes-base.rssFeedReadTrigger": "trigger",
  "n8n-nodes-base.postgresTrigger": "trigger",
  // Service-specific triggers (all webhook-callback based)
  "n8n-nodes-base.activeCampaignTrigger": "trigger",
  "n8n-nodes-base.acuitySchedulingTrigger": "trigger",
  "n8n-nodes-base.affinityTrigger": "trigger",
  "n8n-nodes-base.airtableTrigger": "trigger",
  "n8n-nodes-base.asanaTrigger": "trigger",
  "n8n-nodes-base.autopilotTrigger": "trigger",
  "n8n-nodes-base.awsSnsTrigger": "trigger",
  "n8n-nodes-base.bitbucketTrigger": "trigger",
  "n8n-nodes-base.boxTrigger": "trigger",
  "n8n-nodes-base.brevoTrigger": "trigger",
  "n8n-nodes-base.calTrigger": "trigger",
  "n8n-nodes-base.calendlyTrigger": "trigger",
  "n8n-nodes-base.chargebeeTrigger": "trigger",
  "n8n-nodes-base.ciscoWebexTrigger": "trigger",
  "n8n-nodes-base.clickUpTrigger": "trigger",
  "n8n-nodes-base.clockifyTrigger": "trigger",
  "n8n-nodes-base.convertKitTrigger": "trigger",
  "n8n-nodes-base.copperTrigger": "trigger",
  "n8n-nodes-base.currentsTrigger": "trigger",
  "n8n-nodes-base.customerIoTrigger": "trigger",
  "n8n-nodes-base.emeliaTrigger": "trigger",
  "n8n-nodes-base.eventbriteTrigger": "trigger",
  "n8n-nodes-base.facebookTrigger": "trigger",
  "n8n-nodes-base.facebookLeadAdsTrigger": "trigger",
  "n8n-nodes-base.figmaTrigger": "trigger",
  "n8n-nodes-base.flowTrigger": "trigger",
  "n8n-nodes-base.formIoTrigger": "trigger",
  "n8n-nodes-base.formstackTrigger": "trigger",
  "n8n-nodes-base.getResponseTrigger": "trigger",
  "n8n-nodes-base.githubTrigger": "trigger",
  "n8n-nodes-base.gitlabTrigger": "trigger",
  "n8n-nodes-base.gmailTrigger": "trigger",
  "n8n-nodes-base.googleBusinessProfileTrigger": "trigger",
  "n8n-nodes-base.googleCalendarTrigger": "trigger",
  "n8n-nodes-base.googleDriveTrigger": "trigger",
  "n8n-nodes-base.googleSheetsTrigger": "trigger",
  "n8n-nodes-base.gumroadTrigger": "trigger",
  "n8n-nodes-base.helpScoutTrigger": "trigger",
  "n8n-nodes-base.hubspotTrigger": "trigger",
  "n8n-nodes-base.invoiceNinjaTrigger": "trigger",
  "n8n-nodes-base.jiraTrigger": "trigger",
  "n8n-nodes-base.jotFormTrigger": "trigger",
  "n8n-nodes-base.keapTrigger": "trigger",
  "n8n-nodes-base.koBoToolboxTrigger": "trigger",
  "n8n-nodes-base.lemlistTrigger": "trigger",
  "n8n-nodes-base.linearTrigger": "trigger",
  "n8n-nodes-base.loneScaleTrigger": "trigger",
  "n8n-nodes-base.mailchimpTrigger": "trigger",
  "n8n-nodes-base.mailerLiteTrigger": "trigger",
  "n8n-nodes-base.mailjetTrigger": "trigger",
  "n8n-nodes-base.mauticTrigger": "trigger",
  "n8n-nodes-base.microsoftOneDriveTrigger": "trigger",
  "n8n-nodes-base.microsoftOutlookTrigger": "trigger",
  "n8n-nodes-base.microsoftTeamsTrigger": "trigger",
  "n8n-nodes-base.netlifyTrigger": "trigger",
  "n8n-nodes-base.notionTrigger": "trigger",
  "n8n-nodes-base.onfleetTrigger": "trigger",
  "n8n-nodes-base.payPalTrigger": "trigger",
  "n8n-nodes-base.pipedriveTrigger": "trigger",
  "n8n-nodes-base.postmarkTrigger": "trigger",
  "n8n-nodes-base.pushcutTrigger": "trigger",
  "n8n-nodes-base.salesforceTrigger": "trigger",
  "n8n-nodes-base.seaTableTrigger": "trigger",
  "n8n-nodes-base.shopifyTrigger": "trigger",
  "n8n-nodes-base.slackTrigger": "trigger",
  "n8n-nodes-base.stravaTrigger": "trigger",
  "n8n-nodes-base.stripeTrigger": "trigger",
  "n8n-nodes-base.surveyMonkeyTrigger": "trigger",
  "n8n-nodes-base.taigaTrigger": "trigger",
  "n8n-nodes-base.telegramTrigger": "trigger",
  "n8n-nodes-base.theHiveTrigger": "trigger",
  "n8n-nodes-base.theHiveProjectTrigger": "trigger",
  "n8n-nodes-base.togglTrigger": "trigger",
  "n8n-nodes-base.trelloTrigger": "trigger",
  "n8n-nodes-base.twilioTrigger": "trigger",
  "n8n-nodes-base.typeformTrigger": "trigger",
  "n8n-nodes-base.venafiTlsProtectCloudTrigger": "trigger",
  "n8n-nodes-base.webflowTrigger": "trigger",
  "n8n-nodes-base.whatsAppTrigger": "trigger",
  "n8n-nodes-base.wiseTrigger": "trigger",
  "n8n-nodes-base.wooCommerceTrigger": "trigger",
  "n8n-nodes-base.workableTrigger": "trigger",
  "n8n-nodes-base.wufooTrigger": "trigger",
  "n8n-nodes-base.zendeskTrigger": "trigger",
  "n8n-nodes-base.evaluationTrigger": "trigger",

  // ── Webhook / inbound HTTP ──────────────────────────────────────────────
  "n8n-nodes-base.webhook": "webhook",
  "n8n-nodes-base.formTrigger": "webhook",
  "n8n-nodes-base.form": "webhook",
  "n8n-nodes-base.respondToWebhook": "webhook",

  // ── HTTP / outbound API calls ───────────────────────────────────────────
  "n8n-nodes-base.httpRequest": "http",
  "n8n-nodes-base.graphql": "http",

  // ── Database / data stores ──────────────────────────────────────────────
  "n8n-nodes-base.postgres": "database",
  "n8n-nodes-base.mySql": "database",
  "n8n-nodes-base.sqlite": "database",
  "n8n-nodes-base.mongoDb": "database",
  "n8n-nodes-base.redis": "database",
  "n8n-nodes-base.microsoftSql": "database",
  "n8n-nodes-base.supabase": "database",
  "n8n-nodes-base.questDb": "database",
  "n8n-nodes-base.timescaleDb": "database",
  "n8n-nodes-base.crateDb": "database",
  "n8n-nodes-base.snowflake": "database",
  "n8n-nodes-base.oracleSql": "database",
  "n8n-nodes-base.elasticsearch": "database",
  "n8n-nodes-base.elasticSecurity": "database",
  "n8n-nodes-base.azureCosmosDb": "database",
  "n8n-nodes-base.awsDynamoDb": "database",
  "n8n-nodes-base.databricks": "database",
  "n8n-nodes-base.googleBigQuery": "database",
  "n8n-nodes-base.googleFirebaseCloudFirestore": "database",
  "n8n-nodes-base.googleFirebaseRealtimeDatabase": "database",
  "n8n-nodes-base.nocoDB": "database",
  "n8n-nodes-base.baserow": "database",
  "n8n-nodes-base.seaTable": "database",
  "n8n-nodes-base.grist": "database",
  "n8n-nodes-base.stackby": "database",
  "n8n-nodes-base.quickBase": "database",
  "n8n-nodes-base.fileMaker": "database",
  "n8n-nodes-base.ldap": "database",

  // ── Email ───────────────────────────────────────────────────────────────
  "n8n-nodes-base.emailSend": "email",
  "n8n-nodes-base.emailReadImap": "email",
  "n8n-nodes-base.imap": "email",
  "n8n-nodes-base.gmail": "email",
  "n8n-nodes-base.microsoftOutlook": "email",
  "n8n-nodes-base.sendGrid": "email",
  "n8n-nodes-base.mailchimp": "email",
  "n8n-nodes-base.mailgun": "email",
  "n8n-nodes-base.mailjet": "email",
  "n8n-nodes-base.mandrill": "email",
  "n8n-nodes-base.mailerLite": "email",
  "n8n-nodes-base.convertKit": "email",
  "n8n-nodes-base.sendy": "email",
  "n8n-nodes-base.brevo": "email",
  "n8n-nodes-base.awsSes": "email",
  "n8n-nodes-base.postmark": "email",

  // ── File / storage ──────────────────────────────────────────────────────
  "n8n-nodes-base.readBinaryFile": "file",
  "n8n-nodes-base.writeBinaryFile": "file",
  "n8n-nodes-base.readBinaryFiles": "file",
  "n8n-nodes-base.readWriteFile": "file",
  "n8n-nodes-base.readPdf": "file",
  "n8n-nodes-base.spreadsheetFile": "file",
  "n8n-nodes-base.ftp": "file",
  "n8n-nodes-base.ssh": "file",
  "n8n-nodes-base.s3": "file",
  "n8n-nodes-base.awsS3": "file",
  "n8n-nodes-base.googleDrive": "file",
  "n8n-nodes-base.googleCloudStorage": "file",
  "n8n-nodes-base.microsoftOneDrive": "file",
  "n8n-nodes-base.microsoftSharePoint": "file",
  "n8n-nodes-base.dropbox": "file",
  "n8n-nodes-base.box": "file",
  "n8n-nodes-base.nextCloud": "file",
  "n8n-nodes-base.azureStorage": "file",

  // ── Transform / data manipulation ───────────────────────────────────────
  "n8n-nodes-base.set": "transform",
  "n8n-nodes-base.setV2": "transform",
  "n8n-nodes-base.editFields": "transform",
  "n8n-nodes-base.merge": "transform",
  "n8n-nodes-base.splitInBatches": "transform",
  "n8n-nodes-base.itemLists": "transform",
  "n8n-nodes-base.code": "transform",
  "n8n-nodes-base.function": "transform",
  "n8n-nodes-base.functionItem": "transform",
  "n8n-nodes-base.dateTime": "transform",
  "n8n-nodes-base.crypto": "transform",
  "n8n-nodes-base.html": "transform",
  "n8n-nodes-base.htmlExtract": "transform",
  "n8n-nodes-base.markdown": "transform",
  "n8n-nodes-base.xml": "transform",
  "n8n-nodes-base.json": "transform",
  "n8n-nodes-base.compression": "transform",
  "n8n-nodes-base.convertToFile": "transform",
  "n8n-nodes-base.extractFromFile": "transform",
  "n8n-nodes-base.summarize": "transform",
  "n8n-nodes-base.aggregate": "transform",
  "n8n-nodes-base.rename": "transform",
  "n8n-nodes-base.renameKeys": "transform",
  "n8n-nodes-base.filter": "transform",
  "n8n-nodes-base.sort": "transform",
  "n8n-nodes-base.limit": "transform",
  "n8n-nodes-base.splitOut": "transform",
  "n8n-nodes-base.removeDuplicates": "transform",
  "n8n-nodes-base.compareDatasets": "transform",
  "n8n-nodes-base.moveBinaryData": "transform",
  "n8n-nodes-base.executeCommand": "transform",
  "n8n-nodes-base.aiTransform": "transform",
  "n8n-nodes-base.editImage": "transform",
  "n8n-nodes-base.dataTable": "transform",
  "n8n-nodes-base.iCalendar": "transform",
  "n8n-nodes-base.totp": "transform",
  "n8n-nodes-base.jwt": "transform",
  "n8n-nodes-base.git": "transform",
  "n8n-nodes-base.rssFeedRead": "transform",

  // ── Flow / control ──────────────────────────────────────────────────────
  "n8n-nodes-base.if": "flow",
  "n8n-nodes-base.switch": "flow",
  "n8n-nodes-base.wait": "flow",
  "n8n-nodes-base.stopAndError": "flow",
  "n8n-nodes-base.noOp": "flow",
  "n8n-nodes-base.executeWorkflow": "flow",
  "n8n-nodes-base.stickyNote": "flow",
  "n8n-nodes-base.simulate": "flow",
  "n8n-nodes-base.debugHelper": "flow",
  "n8n-nodes-base.executionData": "flow",
  "n8n-nodes-base.n8n": "flow",

  // ── Messaging ───────────────────────────────────────────────────────────
  "n8n-nodes-base.slack": "http",
  "n8n-nodes-base.discord": "http",
  "n8n-nodes-base.telegram": "http",
  "n8n-nodes-base.twilio": "http",
  "n8n-nodes-base.mattermost": "http",
  "n8n-nodes-base.microsoftTeams": "http",
  "n8n-nodes-base.whatsApp": "http",
  "n8n-nodes-base.matrix": "http",
  "n8n-nodes-base.rocketchat": "http",
  "n8n-nodes-base.twake": "http",
  "n8n-nodes-base.twist": "http",
  "n8n-nodes-base.zulip": "http",
  "n8n-nodes-base.line": "http",
  "n8n-nodes-base.vonage": "http",
  "n8n-nodes-base.mocean": "http",
  "n8n-nodes-base.messagebird": "http",
  "n8n-nodes-base.msg91": "http",
  "n8n-nodes-base.plivo": "http",
  "n8n-nodes-base.sms77": "http",
  "n8n-nodes-base.gotify": "http",
  "n8n-nodes-base.pushbullet": "http",
  "n8n-nodes-base.pushcut": "http",
  "n8n-nodes-base.pushover": "http",
  "n8n-nodes-base.signl4": "http",
  "n8n-nodes-base.ciscoWebex": "http",

  // ── Message queues / IoT ────────────────────────────────────────────────
  "n8n-nodes-base.amqp": "http",
  "n8n-nodes-base.mqtt": "http",
  "n8n-nodes-base.kafka": "http",
  "n8n-nodes-base.rabbitMq": "http",

  // ── Productivity / project management ───────────────────────────────────
  "n8n-nodes-base.notion": "http",
  "n8n-nodes-base.googleSheets": "http",
  "n8n-nodes-base.airtable": "http",
  "n8n-nodes-base.asana": "http",
  "n8n-nodes-base.trello": "http",
  "n8n-nodes-base.todoist": "http",
  "n8n-nodes-base.clickup": "http",
  "n8n-nodes-base.mondayCom": "http",
  "n8n-nodes-base.linear": "http",
  "n8n-nodes-base.coda": "http",
  "n8n-nodes-base.googleTasks": "http",
  "n8n-nodes-base.microsoftToDo": "http",
  "n8n-nodes-base.wekan": "http",
  "n8n-nodes-base.taiga": "http",
  "n8n-nodes-base.clockify": "http",
  "n8n-nodes-base.toggl": "http",
  "n8n-nodes-base.harvest": "http",
  "n8n-nodes-base.raindrop": "http",

  // ── CRM / business ─────────────────────────────────────────────────────
  "n8n-nodes-base.hubspot": "http",
  "n8n-nodes-base.salesforce": "http",
  "n8n-nodes-base.pipedrive": "http",
  "n8n-nodes-base.zendesk": "http",
  "n8n-nodes-base.freshdesk": "http",
  "n8n-nodes-base.freshservice": "http",
  "n8n-nodes-base.freshworksCrm": "http",
  "n8n-nodes-base.activeCampaign": "http",
  "n8n-nodes-base.agileCrm": "http",
  "n8n-nodes-base.affinity": "http",
  "n8n-nodes-base.autopilot": "http",
  "n8n-nodes-base.copper": "http",
  "n8n-nodes-base.intercom": "http",
  "n8n-nodes-base.keap": "http",
  "n8n-nodes-base.monicaCrm": "http",
  "n8n-nodes-base.salesmate": "http",
  "n8n-nodes-base.zohoCrm": "http",
  "n8n-nodes-base.zammad": "http",
  "n8n-nodes-base.haloPSA": "http",
  "n8n-nodes-base.highLevel": "http",
  "n8n-nodes-base.serviceNow": "http",
  "n8n-nodes-base.syncroMsp": "http",
  "n8n-nodes-base.onfleet": "http",
  "n8n-nodes-base.gong": "http",
  "n8n-nodes-base.microsoftDynamicsCrm": "http",

  // ── Developer tools ─────────────────────────────────────────────────────
  "n8n-nodes-base.github": "http",
  "n8n-nodes-base.gitlab": "http",
  "n8n-nodes-base.bitbucket": "http",
  "n8n-nodes-base.jenkins": "http",
  "n8n-nodes-base.circleCI": "http",
  "n8n-nodes-base.travisCi": "http",
  "n8n-nodes-base.rundeck": "http",
  "n8n-nodes-base.sentryIo": "http",
  "n8n-nodes-base.netlify": "http",
  "n8n-nodes-base.npm": "http",
  "n8n-nodes-base.postBin": "http",
  "n8n-nodes-base.webflow": "http",
  "n8n-nodes-base.splunk": "http",
  "n8n-nodes-base.grafana": "http",

  // ── E-commerce ──────────────────────────────────────────────────────────
  "n8n-nodes-base.shopify": "http",
  "n8n-nodes-base.wooCommerce": "http",
  "n8n-nodes-base.magento2": "http",
  "n8n-nodes-base.unleashedSoftware": "http",
  "n8n-nodes-base.paddle": "http",

  // ── Finance / payments ──────────────────────────────────────────────────
  "n8n-nodes-base.stripe": "http",
  "n8n-nodes-base.paypal": "http",
  "n8n-nodes-base.quickBooks": "http",
  "n8n-nodes-base.xero": "http",
  "n8n-nodes-base.wise": "http",
  "n8n-nodes-base.chargebee": "http",
  "n8n-nodes-base.invoiceNinja": "http",
  "n8n-nodes-base.profitWell": "http",

  // ── Social / media ──────────────────────────────────────────────────────
  "n8n-nodes-base.twitter": "http",
  "n8n-nodes-base.linkedIn": "http",
  "n8n-nodes-base.reddit": "http",
  "n8n-nodes-base.facebookGraphApi": "http",
  "n8n-nodes-base.spotify": "http",
  "n8n-nodes-base.youTube": "http",
  "n8n-nodes-base.medium": "http",
  "n8n-nodes-base.strava": "http",
  "n8n-nodes-base.disqus": "http",
  "n8n-nodes-base.discourse": "http",

  // ── Google (beyond Sheets/Drive/Gmail) ──────────────────────────────────
  "n8n-nodes-base.openAi": "http",
  "n8n-nodes-base.googleAds": "http",
  "n8n-nodes-base.googleAnalytics": "http",
  "n8n-nodes-base.googleBooks": "http",
  "n8n-nodes-base.googleCalendar": "http",
  "n8n-nodes-base.googleChat": "http",
  "n8n-nodes-base.googleCloudNaturalLanguage": "http",
  "n8n-nodes-base.googleContacts": "http",
  "n8n-nodes-base.googleDocs": "http",
  "n8n-nodes-base.gSuiteAdmin": "http",
  "n8n-nodes-base.googleBusinessProfile": "http",
  "n8n-nodes-base.googlePerspective": "http",
  "n8n-nodes-base.googleSlides": "http",
  "n8n-nodes-base.googleTranslate": "http",

  // ── AWS (beyond S3/SES/SNS/SQS/DynamoDB) ───────────────────────────────
  "n8n-nodes-base.awsSns": "http",
  "n8n-nodes-base.awsSqs": "http",
  "n8n-nodes-base.awsLambda": "http",
  "n8n-nodes-base.awsCertificateManager": "http",
  "n8n-nodes-base.awsCognito": "http",
  "n8n-nodes-base.awsComprehend": "http",
  "n8n-nodes-base.awsElb": "http",
  "n8n-nodes-base.awsIam": "http",
  "n8n-nodes-base.awsRekognition": "http",
  "n8n-nodes-base.awsTextract": "http",
  "n8n-nodes-base.awsTranscribe": "http",

  // ── Microsoft (beyond SQL/Outlook/Teams/OneDrive/SharePoint) ────────────
  "n8n-nodes-base.microsoftEntra": "http",
  "n8n-nodes-base.microsoftExcel": "http",
  "n8n-nodes-base.microsoftGraphSecurity": "http",

  // ── Security / threat intel ─────────────────────────────────────────────
  "n8n-nodes-base.alienVault": "http",
  "n8n-nodes-base.cortex": "http",
  "n8n-nodes-base.misp": "http",
  "n8n-nodes-base.theHive": "http",
  "n8n-nodes-base.theHiveProject": "http",
  "n8n-nodes-base.urlScanIo": "http",
  "n8n-nodes-base.securityScorecard": "http",

  // ── Marketing / automation ──────────────────────────────────────────────
  "n8n-nodes-base.mautic": "http",
  "n8n-nodes-base.getResponse": "http",
  "n8n-nodes-base.lemlist": "http",
  "n8n-nodes-base.emelia": "http",
  "n8n-nodes-base.egoi": "http",
  "n8n-nodes-base.customerIo": "http",
  "n8n-nodes-base.vero": "http",
  "n8n-nodes-base.segment": "http",
  "n8n-nodes-base.actionNetwork": "http",

  // ── CMS / content ───────────────────────────────────────────────────────
  "n8n-nodes-base.contentful": "http",
  "n8n-nodes-base.strapi": "http",
  "n8n-nodes-base.storyblok": "http",
  "n8n-nodes-base.wordpress": "http",
  "n8n-nodes-base.ghost": "http",
  "n8n-nodes-base.cockpit": "http",
  "n8n-nodes-base.bubble": "http",

  // ── Scheduling / calendars ──────────────────────────────────────────────
  "n8n-nodes-base.calendly": "http",
  "n8n-nodes-base.cal": "http",
  "n8n-nodes-base.acuityScheduling": "http",
  "n8n-nodes-base.demio": "http",
  "n8n-nodes-base.goToWebinar": "http",

  // ── Analytics / monitoring ──────────────────────────────────────────────
  "n8n-nodes-base.postHog": "http",
  "n8n-nodes-base.metabase": "http",
  "n8n-nodes-base.uptimeRobot": "http",

  // ── Forms / surveys ─────────────────────────────────────────────────────
  "n8n-nodes-base.typeform": "http",
  "n8n-nodes-base.surveyMonkey": "http",
  "n8n-nodes-base.jotForm": "http",
  "n8n-nodes-base.formIo": "http",
  "n8n-nodes-base.formstack": "http",
  "n8n-nodes-base.wufoo": "http",

  // ── Misc SaaS integrations ──────────────────────────────────────────────
  "n8n-nodes-base.airtop": "http",
  "n8n-nodes-base.adalo": "http",
  "n8n-nodes-base.apiTemplateIo": "http",
  "n8n-nodes-base.bambooHr": "http",
  "n8n-nodes-base.bannerbear": "http",
  "n8n-nodes-base.beeminder": "http",
  "n8n-nodes-base.bitly": "http",
  "n8n-nodes-base.bitwarden": "http",
  "n8n-nodes-base.brandfetch": "http",
  "n8n-nodes-base.clearbit": "http",
  "n8n-nodes-base.cloudflare": "http",
  "n8n-nodes-base.coinGecko": "http",
  "n8n-nodes-base.currents": "http",
  "n8n-nodes-base.deepL": "http",
  "n8n-nodes-base.dhl": "http",
  "n8n-nodes-base.drift": "http",
  "n8n-nodes-base.dropcontact": "http",
  "n8n-nodes-base.erpNext": "http",
  "n8n-nodes-base.flow": "http",
  "n8n-nodes-base.hackerNews": "http",
  "n8n-nodes-base.homeAssistant": "http",
  "n8n-nodes-base.humanticAi": "http",
  "n8n-nodes-base.hunter": "http",
  "n8n-nodes-base.iterable": "http",
  "n8n-nodes-base.jinaAi": "http",
  "n8n-nodes-base.koBoToolbox": "http",
  "n8n-nodes-base.lingvaNex": "http",
  "n8n-nodes-base.loneScale": "http",
  "n8n-nodes-base.mailcheck": "http",
  "n8n-nodes-base.marketstack": "http",
  "n8n-nodes-base.mindee": "http",
  "n8n-nodes-base.mistralAi": "http",
  "n8n-nodes-base.nasa": "http",
  "n8n-nodes-base.netscalerAdc": "http",
  "n8n-nodes-base.odoo": "http",
  "n8n-nodes-base.okta": "http",
  "n8n-nodes-base.oneSimpleApi": "http",
  "n8n-nodes-base.openThesaurus": "http",
  "n8n-nodes-base.openWeatherMap": "http",
  "n8n-nodes-base.orbit": "http",
  "n8n-nodes-base.oura": "http",
  "n8n-nodes-base.pagerDuty": "http",
  "n8n-nodes-base.peekalink": "http",
  "n8n-nodes-base.perplexity": "http",
  "n8n-nodes-base.phantombuster": "http",
  "n8n-nodes-base.philipsHue": "http",
  "n8n-nodes-base.tapfiliate": "http",
  "n8n-nodes-base.uplead": "http",
  "n8n-nodes-base.uProc": "http",
  "n8n-nodes-base.venafiTlsProtectCloud": "http",
  "n8n-nodes-base.venafiTlsProtectDatacenter": "http",
  "n8n-nodes-base.yourls": "http",
  "n8n-nodes-base.zoom": "http",
  "n8n-nodes-base.jira": "http",

  // ── LangChain / AI nodes ────────────────────────────────────────────────
  "@n8n/n8n-nodes-langchain.lmChatOpenAi": "transform",
  "@n8n/n8n-nodes-langchain.lmChatAnthropic": "transform",
  "@n8n/n8n-nodes-langchain.lmChatGoogleGemini": "transform",
  "@n8n/n8n-nodes-langchain.lmChatOllama": "transform",
  "@n8n/n8n-nodes-langchain.lmChatMistralCloud": "transform",
  "@n8n/n8n-nodes-langchain.lmOpenAi": "transform",
  "@n8n/n8n-nodes-langchain.chainLlm": "transform",
  "@n8n/n8n-nodes-langchain.chainSummarization": "transform",
  "@n8n/n8n-nodes-langchain.chainRetrievalQa": "transform",
  "@n8n/n8n-nodes-langchain.agent": "transform",
  "@n8n/n8n-nodes-langchain.agentZeroShot": "transform",
  "@n8n/n8n-nodes-langchain.toolCode": "transform",
  "@n8n/n8n-nodes-langchain.toolHttpRequest": "transform",
  "@n8n/n8n-nodes-langchain.toolWorkflow": "flow",
  "@n8n/n8n-nodes-langchain.embeddingsOpenAi": "transform",
  "@n8n/n8n-nodes-langchain.embeddingsGoogleGemini": "transform",
  "@n8n/n8n-nodes-langchain.vectorStorePinecone": "database",
  "@n8n/n8n-nodes-langchain.vectorStoreSupabase": "database",
  "@n8n/n8n-nodes-langchain.vectorStoreInMemory": "transform",
  "@n8n/n8n-nodes-langchain.documentDefaultDataLoader": "transform",
  "@n8n/n8n-nodes-langchain.textSplitterRecursiveCharacterTextSplitter": "transform",
  "@n8n/n8n-nodes-langchain.memoryBufferWindow": "transform",
  "@n8n/n8n-nodes-langchain.memoryManager": "transform",
  "@n8n/n8n-nodes-langchain.outputParserStructured": "transform",
  "@n8n/n8n-nodes-langchain.outputParserAutofixing": "transform",
};

// ---------------------------------------------------------------------------
// Prefix-based fallback — catches version suffixes and sub-variants.
// ---------------------------------------------------------------------------

const PREFIX_MAP: Array<[prefix: string, category: NodeCategory]> = [
  ["n8n-nodes-base.postgres", "database"],
  ["n8n-nodes-base.mySql", "database"],
  ["n8n-nodes-base.mongo", "database"],
  ["n8n-nodes-base.redis", "database"],
  ["n8n-nodes-base.supabase", "database"],
  ["n8n-nodes-base.webhook", "webhook"],
  ["n8n-nodes-base.email", "email"],
  ["n8n-nodes-base.gmail", "email"],
  ["@n8n/n8n-nodes-langchain", "transform"],
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function categorizeNode(nodeType: string): NodeCategory {
  if (EXACT_MAP[nodeType] !== undefined) return EXACT_MAP[nodeType];

  for (const [prefix, category] of PREFIX_MAP) {
    if (nodeType.startsWith(prefix)) return category;
  }

  // Suffix fallback: any node type ending in "Trigger" is a trigger,
  // even if we haven't mapped it explicitly (future-proofing).
  const shortName = nodeType.split(".").pop() ?? "";
  if (shortName.endsWith("Trigger")) return "trigger";

  return "unknown";
}

export function deriveTriggerType(nodes: Array<{ type: string }>): TriggerType {
  for (const node of nodes) {
    const t = node.type;

    // Webhook (direct inbound HTTP)
    if (t === "n8n-nodes-base.webhook" || t === "n8n-nodes-base.formTrigger" || t === "n8n-nodes-base.form")
      return "webhook";

    // Schedule / cron
    if (
      t === "n8n-nodes-base.scheduleTrigger" ||
      t === "n8n-nodes-base.cronTrigger" ||
      t === "n8n-nodes-base.cron" ||
      t === "n8n-nodes-base.intervalTrigger" ||
      t === "n8n-nodes-base.interval"
    )
      return "schedule";

    // Manual
    if (t === "n8n-nodes-base.manualTrigger" || t === "n8n-nodes-base.start")
      return "manual";
  }

  // Suffix fallback: any node whose short name ends with "Trigger"
  // that wasn't matched above is an event-based trigger.
  for (const node of nodes) {
    const shortName = node.type.split(".").pop() ?? "";
    if (shortName.endsWith("Trigger")) return "event";
  }

  return "unknown";
}

/** All explicitly mapped node type strings — used by --inspect and docs. */
export function knownNodeTypes(): string[] {
  return Object.keys(EXACT_MAP);
}
