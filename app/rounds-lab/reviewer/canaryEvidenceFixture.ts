// LOCAL_CANARY_EVIDENCE_FIXTURE: mechanically projected from
// /private/tmp/podcast-evidence-v2-gu-canary-10-source-pack.json on 2026-08-29.
// These are bounded transcript windows plus preceding discourse, not complete
// episode transcripts. They are reviewer-only and disconnected from production.

export type CanaryTranscriptWindow = {
  id: string;
  sourceKey: string;
  rowIds: string[];
  targetIdentifiers: string[];
  episode: {
    title: string;
    url: string;
    show: string;
    publishedAt: string;
  };
  audio: {
    episodeId: string;
    audioUrl: string;
    startMs: number;
    endMs: number;
  };
  contextInterval: {
    startMs: number;
    endMs: number;
    leadMs: number;
    tailMs: number;
  };
  discourseInterval: {
    startMs: number;
    endMs: number;
    leadMs: number;
    maxChars: number;
  };
  text: string;
  discourseText: string;
};

export const LOCAL_CANARY_TRANSCRIPT_WINDOWS =
[
  {
    "id": "gu-canary-01-tar-210",
    "sourceKey": "997c2035-4dba-47a2-80f7-3c58aef6c76b:NCT05567185:912280:1010730",
    "rowIds": [
      "b941a235-5352-4624-b454-9bc05e8a1c65:65ec6d9c-25d5-4e41-ac60-b15a6565fa77:912280:1010730"
    ],
    "targetIdentifiers": [
      "NCT05567185"
    ],
    "episode": {
      "title": "Non-Muscle-Invasive and Muscle-Invasive Bladder Cancer — Microlearning Activity 3: Proceedings from a Session Held Adjunct to the 2026 ASCO GU Cancers Symposium",
      "url": "https://oncologytoday.captivate.fm/episode/5953-ascogu2026-nmbladder-micro3",
      "show": "Oncology Today with Dr Neil Love",
      "publishedAt": "2026-08-26T13:30:00+00:00"
    },
    "audio": {
      "episodeId": "b941a235-5352-4624-b454-9bc05e8a1c65",
      "audioUrl": "https://dts.podtrac.com/redirect.mp3/episodes.captivate.fm/episode/abd95e23-dfaa-4184-bec9-a4adfbd880b3.mp3",
      "startMs": 912280,
      "endMs": 1010730
    },
    "contextInterval": {
      "startMs": 897280,
      "endMs": 1040730,
      "leadMs": 15000,
      "tailMs": 30000
    },
    "discourseInterval": {
      "startMs": 0,
      "endMs": 912280,
      "leadMs": 1200000,
      "maxChars": 3000
    },
    "text": "Yes, this is the major point. I suspect also that from the urologist standpoint, even though they seem to be quite happy in using BCG, whenever they got any alternative therapy that is effective or more effective than BCG, they will jump directly in this direction. As we did for standard cisplatin-based chemotherapy in the neoadjuvant setting, whenever we had any alternative option, we always— all of us, we jumped into this direction. So it depends, as you said, on the magnitude of effect for sure. And the trial should be clearly positive with regards to the primary endpoint and maybe key secondary endpoints. The BCG is hard to beat. Has demonstrated to be very hard to beat in clinical trials. The performance is quite good for BCG. It reminds me a situation in the MYE-BC, which is similar for chemoradiation. So very hard-to-beat comparator because in clinical trials, the performance is quite good. So let's see. But for sure, I agree with the colleagues that positivity of Sunris3 trial will make a huge difference in the way we sequence intravesical therapies in patients with mIBC.\n\nOkay, so much more to come in the frontline setting, and I think it sounds like we're going to need to hear about the efficacy. Maybe toxicity is going to be similar between BCG and TAR-200, perhaps. Dr. Gupta, so FGFR-altered bladder cancer is one of the only truly biomarker-defined diseases we have. There was data that Dr. Nekhi showed us about giving oral Erdafitinib that seemed to be fairly toxic in terms of side effects. What do you think about TAR-210? What I'd love to know is if you have a patient who has an FGFR mutation, do we think TAR-210 is a better drug than TAR-200? Are we actually achieving something by looking for this biomarker and treating, or is it too early to say?\n\nI think FGFR is the only biomarker right now which is truly— that drives the cancers, and we have a therapy for it. So I think oral Erdafitinib is definitely very, very toxic, especially in patients with this early stage, and that's why the study was stopped early. And I think the TAR-210 data is really compelling. You're getting the efficacy from the FGFR inhibitor without the systemic toxicity. It's best of both the worlds, in my opinion, and definitely would go for that. So it seems like it may be an option in the future. I want to emphasize, when Dr. Nekhi showed us the PK, there's like a 2-log-fold less, like 100-fold less Erdafitinib being absorbed when we give TAR-210. I guess open up to the panel. Do we think that TAR-200 is going to be inferior in an FGFR-positive population? We don't know. Is there a rationale to sort of develop both drugs? I mean, clearly they are being developed, but how do you think about that?\n\nGo ahead. I just want to add that in all the other studies with TAR-210, 200, we really don't know what percent of patients were FGFR-altered tumors. So it would be good to look at that retrospectively and see how they did and make that decision. Agreed. Any other comments about other therapies that we should be putting into this patient population who has sort of high-risk non-muscle invasive and any comparative efficacy that we have? Well, We do have the data from nadoferogin that are pretty much consistent with the data obtained with pembrolizumab monotherapy. It's a way of achieving similar results by delivering intravasically a drug instead of systemic therapy. So clearly, results in this sense as a second option in theory after the results shown with the Tar-200 and Cratostimab that are at the forefront of the development with regards to CR and maintaining CR. There could be additional data that soon the data will be presented with newer systemic immunotherapy combinations showing that there is no signal for enrichment in CR, but we do have much more toxicity events in this patient population. So, the struggle is, again, in identifying possible new combination therapies that are aimed to minimize a little bit the toxicity that we can provide to the patients with systemic therapies. It's a challenge, but today, the primary focus is on monotherapy as intravesical therapy.",
    "discourseText": "The phase 3 KEYNOTE-905 EV-303 study of neoadjuvant Enfortumab vedotin plus Pembrolizumab in cisplatin-ineligible patients with muscle-invasive bladder cancer presented at ESMO, and the phase 3 KEYNOTE-B-015 EV304 trial of Evipembro in cisplatin-eligible patients being presented tomorrow morning at this conference are rapidly shifting the treatment landscape for localized bladder cancer, as evidenced by Dr.\n\nThere's GEM-CIS, Durvalumab, and also we had a clinical trial also where they were getting EV Pemra as a perioperative with the vaccine study.\n\nMatt, you have had a large role in the EV304 trial.\n\nWe have informed patients who come in and want this treatment after having heard about the ESMO data, and I think it's reasonable to discuss it, particularly because that trial included patients who declined cisplatin-based therapy as well.\n\nNow, Matt, you led a very important study looking at preserving the bladder in which patients got neoadjuvant platinum and a PD-1 inhibitor.\n\nThen do you think there's a role for giving EVP and then monitoring patients very closely as that was done in this HOOSIER trial and allowing them to keep the bladder, especially in someone who's 80 years old and may have competing comorbidities.\n\nThat's the trial that this patient was enrolled on, was EVP with potential for no cystectomy in patients who have a clinical complete response.\n\nThere's a Sunrise3 study, which is looking not at BCG refractory carcinoma in situ, but frontline high-risk disease.\n\nWell, with regards to tolerability, at least recorded within a clinical trial, the data are very favorable in supporting the use of Tar-200 in this patient population."
  },
  {
    "id": "gu-canary-02-psma-addition",
    "sourceKey": "33f362c7-59a1-4fc0-82cf-9c5e91b57391:NCT06282588:2394760:2531020",
    "rowIds": [
      "d362e267-9ea9-4ce9-a5e1-adb82816962a:56f4cd45-5466-4909-8eb3-58eb324e12f7:2394760:2531020"
    ],
    "targetIdentifiers": [
      "NCT06282588"
    ],
    "episode": {
      "title": "Genitourinary Cancers — Reviewing Key Presentations from the 2026 ASCO Annual Meeting",
      "url": "https://oncologytoday.captivate.fm/episode/6185-postasco2026-gu",
      "show": "Oncology Today with Dr Neil Love",
      "publishedAt": "2026-08-19T18:00:00+00:00"
    },
    "audio": {
      "episodeId": "d362e267-9ea9-4ce9-a5e1-adb82816962a",
      "audioUrl": "https://dts.podtrac.com/redirect.mp3/episodes.captivate.fm/episode/d554ef38-b235-4626-9a6b-371b3883f6c8.mp3",
      "startMs": 2394760,
      "endMs": 2531020
    },
    "contextInterval": {
      "startMs": 2379760,
      "endMs": 2561020,
      "leadMs": 15000,
      "tailMs": 30000
    },
    "discourseInterval": {
      "startMs": 1194760,
      "endMs": 2394760,
      "leadMs": 1200000,
      "maxChars": 3000
    },
    "text": "So I don't know, Tyenne and Matt, whether you're sort of jealous of radioligand therapy or whether you think maybe it'll ever come to your tumors of this really impressive response. What do you see in terms of tolerability, Rahul? I've heard about dry mouth. Do you see cytopenias? It seems like it's a very favorable tolerability profile. Yeah, I think head-to-head versus cabazitaxel, no question quality of life was better with lutetium in the castrate-resistant setting. I think in the hormone-sensitive setting or earlier mCRPC, I think what we often do is use adaptive dosing where if a patient has an excellent response like this, we'll stop. We'll follow their scans and PSA, and that really helps mitigate toxicity. But in general, it seems to be a quite tolerable treatment. Dry mouth, typically fairly low grade. As we get into Actinium and some of the newer isotopes, we'll just have to see how that toxicity manifests.\n\nHow are people responding? Go ahead, Tyenne. Go ahead, please. I was just going to say, we are seeing such nice responses with PSMA Lutetium. One thing I would note, and Rahul alluded to it, is that the responses are not always durable. And so sometimes as patients then progress, there are some that are being rechallenged. And I think really tailoring it for the degree of PSMA uptake is spot on, Rahul. Yeah, that's a great point. I'm curious, Tyenne, what are you hearing your colleagues saying? What are you talking about in tumor boards about the possibility of doing what we're about to talk about, the PSMA-Addition trial? Now moving this up into the hormone-sensitive space that, as you can see, is very crowded. What are you thinking about whether you'd want to do this or not and in what situations, Tyenne?\n\nI think it really depends on PSMA avidity. Across our hormone-sensitive spaces, there's a lot of options and we don't have the approval yet, PSMA-Addition was a positive trial right out last year. And so if lutetium comes into that space, it's really thinking about who has those very bright SUVs, means over 10, that might be the right patient to treat with lutetium compared to the other options that Rahul just outlined so nicely. That's really interesting. I haven't heard anybody make that point, but it really makes a lot of sense. Rahul, how are you processing it? Would you like to be able to use this strategy right now? Would you have used it in a patient like this patient upfront if you could have?\n\nYeah, I think Tyenne raises a great point. Instead of thinking of PSMA PET as a binary positive-negative, it's really a spectrum. The more avidity, the more likely it is you're to see benefit. You could define that different ways, but it's a little bit of that eyeball test and reviewing with radiology. Yeah, you have a very PSMA PET avid patient, I'd happily give them this triplet as opposed to a taxane triplet in the hormone-sensitive setting. All right, let's take a— talk a little bit about the data.\n\nYeah, absolutely. So these are just a summary of— these are previously published and presented data of the 2 trials of lutetium-617 in the mCRPC setting. On the left was PSMA-4 in the pretaxane, on the right post-taxane, the VISION study. Vision, no question there's an overall survival benefit. PSMA-4 allowed crossover. So over half of patients in the control arm did receive lutetium and that definitely confounded the OS benefit. When you adjust for that, you do see a significant benefit. And of course this led to FDA approval of lutetium in the CRPC setting. I think we're excited to see what happens in the hormone-sensitive setting. This was the schema for the PSMA-Addition trial, 6 cycles. So standard dosing in PSMA PET-positive hormone-sensitive disease. Dealer's choice ARPI doublet control arm. And, you know, we've seen the primary results of this study. That was the RPFS on the top left. What Fred Saad and colleagues presented at ASCO this year was really the subgroup analysis looking at low versus high volume, de novo versus recurrent metastatic disease. Take-home point, generally you see a consistent benefit across these clinically defined subgroups. And then just finally finishing up on some really interesting data with Actinium-617. Alpha particle, shorter path length, higher linear energy. This is a trial with a drug that was given every 8 weeks for up to 6 cycles as a dose escalation and expansion study. You can see the 3 different groups defined based on their prior therapy appear to be pretty well tolerated. You do tend to see pretty high rates of dry mouth, xerostomia. Don't see a huge amount of cytopenia, so pretty good tolerability. Did not reach its MTD. And really impressive PSA waterfall plots, including in the prior lutetium group, which— that's Group C on the bottom right. See, the majority of patients have a PSA decline. We'll have to follow patients longer to really understand duration and RPFS and so forth.",
    "discourseText": "So one of my favorite trials for the last 5 years has been the EMBARC study, and it just keeps on giving great information.\n\nThis study was conducted prior to the era of PSMA PET imaging, but nevertheless a very important study.\n\nAnd importantly, this study allowed treatment interruption after 9 months of therapy in patients that had a PSA NATR that was less than 0.\n\nSo one of the things I love the most about the EMBARC study is they, to me, they really brought in the issue of intermittent therapy that had kind of been discussed in the past.\n\nSo covering all of oncology, we a lot of times bring up the EMBARC study when we talk about other— for example, in CLL, they talk about time-limited therapy and we go, well, yeah, they've been doing that prostate cancer for a while.\n\nSo this was a study in patients that had an optimal PSA nadir, less than 0.\n\nAnd we'll cover 3 abstracts, the Capivasertib trial, the TALAPRO-3 study, and also prior data from the AMPLITUDE trial that was presented last year.\n\nBut one of the other things that came out when this trial was presented was sort of the natural history of these patients with PTEN deletion.\n\nThese trials had hemoglobin A1C restrictions.\n\nThese studies did have entry criteria based on A1C, but I'd say we may need to be even more stringent in clinical practice.\n\nAnd of course, in that first-line mCRPC setting, we have 3 positive phase 3 trials, MAGNITUDE, PROPEL, and TALAPRO-2, that have all showed a benefit, particularly and most deeply in the BRCA1, BRCA2 mutated tumors.\n\nAnd so this is updates from the PSMA-Addition study."
  },
  {
    "id": "gu-canary-03-checkmate-274",
    "sourceKey": "c55f8510-4723-4c49-9455-4d77cfcd8abe:NCT02632409:87224:288517",
    "rowIds": [
      "c55f8510-4723-4c49-9455-4d77cfcd8abe:895243cd-2a3e-4da3-bc6a-6315b638962d:87224:288517"
    ],
    "targetIdentifiers": [
      "NCT02632409"
    ],
    "episode": {
      "title": "Non-Muscle-Invasive and Muscle-Invasive Bladder Cancer — Microlearning Activity 2: Proceedings from a Session Held Adjunct to the 2026 ASCO GU Cancers Symposium",
      "url": "https://videopodcast.researchtopractice.com/non-muscle-invasive-and-muscle-invasive-bladder-cancer-microlearning-activity-2-proceedings-from-a-session-held-adjunct-to-the-2026-asco-gu-cancers-symposium",
      "show": "Research To Practice | Oncology Videos",
      "publishedAt": "2026-08-15T13:00:00+00:00"
    },
    "audio": {
      "episodeId": "c55f8510-4723-4c49-9455-4d77cfcd8abe",
      "audioUrl": "https://traffic.libsyn.com/secure/researchtopractice/ASCO_GU_Bladder_2-26-26_ML_V3FC_Issue_2_480.mp4?dest-id=1103750",
      "startMs": 87224,
      "endMs": 288517
    },
    "contextInterval": {
      "startMs": 72224,
      "endMs": 318517,
      "leadMs": 15000,
      "tailMs": 30000
    },
    "discourseInterval": {
      "startMs": 0,
      "endMs": 87224,
      "leadMs": 1200000,
      "maxChars": 3000
    },
    "text": "Welcome to Second Opinion: Integrating Novel Approaches into the Management of Non-Muscle-Invasive and Muscle-Invasive Bladder Cancer. This is medical oncologist Dr. Neil Love. On February 26th, at the 2026 GU Cancer Symposium in San Francisco, we held a CME meeting moderated by Dr. Terence Friedlander from the Helen Diller Family Comprehensive Cancer Center in San Francisco and faculty members Dr. Matt Galsky from the Tisch Cancer Institute in New York City, Dr. Andrea Necchi from the IRCCS San Raffaele Hospital in Milan, Italy, and Dr. Shilpa Gupta from the Taussig Cancer Institute in Cleveland, Ohio. Included in the meeting were a series of prerecorded video case presentations by Dr. Elizabeth Plimack from the Fox Chase Cancer Center in Philadelphia, and Professor Thomas Powells from the Bart's Cancer Institute in London, who met with me prior to the meeting. These cases were discussed by the faculty panel, beginning with Dr. Plimack. Adjuvant therapy of muscle-invasive urothelial bladder cancer took a major step forward at the October ESMO meeting when Professor Powells presented the INVIGOR-011 trial, And Dr. Plimack presented a patient she evaluated last year before the data were available.\n\nShe was 68 years old, T3N0 upper tract urothelial carcinoma resected. And based on the pathology, she was referred to a local medical oncologist who recommended adjuvant Nivolumab. She sought a second opinion. So I'm curious, how would you have thought through this case? What would you have advised her? So what actually did you discuss with her? So we discussed the adjuvant Nivolumab data with CheckMate 274. We did discuss the subgroup of upper tract urothelial carcinoma, which did not appear to benefit, as did the whole group as a whole. At the end of that conversation, she was hesitant to proceed. And so we discussed further using ctDNA to help make a decision. We ordered the Signatera test. Her CAT scan was clear and her ctDNA was negative. What would you have done in this situation? She decided to be observed without adjuvant treatment. We've had at least one follow-up scan and repeat ctDNA. Those are both negative as well. So, so far so good. For this particular patient, I ordered ctDNA to try to inform our decision. Is that something you do in routine practice? I elected to use the Signatera assay, which is a tumor-informed ctDNA test. What tests do you all use in your clinics in this situation?\n\nGreat. So this is a case of a 68-year-old woman with upper tract urothelial cancer. We've mostly been talking about muscle-invasive bladder cancer, who's now had the tumor removed and is considered high risk for relapse, but technically is disease-free. And so I know we didn't focus so much on the adjuvant nivolumab data, the CheckMate 274 data, but Dr. Gupta, How would you advise that patient? And do you agree with Dr. Plimick that there's not great data for the upper tract patients to get adjuvant Nivolumab? Yeah, I mean, adjuvant Nivolumab is approved for both MIBC and upper tract disease. But if we do look at the subgroup analysis, the upper tract patients did not benefit. But that's also true for any adjuvant IO trial, both the INVIGOR-010 as well as the AMBASIDATE trial. But I think we do have a valid option for this patient, adjuvant GEM-CIS or GEM-CARBO based on the POUT trial. That's the only level 1 evidence to date in adjuvant upper tract. I'm curious if Dr. Plimek discussed that or not, but I think that is something I would discuss with the patient.\n\nYou might lean towards discussing adjuvant chemo, which feels a little retro these days, as opposed to an adjuvant IO. Now, Dr. Galsky, you had a major role in this trial. Do you want to have anything to add to that assessment, or would you have treated the patient differently just without the cell-free DNA, just based on pathologic data? Yeah, so I think we have to be careful about making major conclusions from hypothesis-generating underpowered subgroup analyses. If you look at the subgroup analysis for upper tract disease for the DFS endpoint in CheckMate 274, the effect size did seem to be less. But if you look at the overall survival subgroup analysis, that wasn't true. And so it just goes to show you, if you look at multiple subgroups, you can be misled. So I don't view that data as definitive for not recommending adjuvant immune checkpoint blockade for patients with HER2-trach.\n\nSo you think that would still be an option for this patient? And how do you, how do you think between, you know, we have the PAUT data which looked at adjuvant platinum-based chemotherapy that was beneficial, and you have CheckMate 274 looking at adjuvant Nivo, how do you counsel a patient? And we're in an era where actually GEM-CIS Nivo is considered a standard standard perioperative regimen, technically neoadjuvant. Is there a role for giving platinum plus a PD-1 to someone if you think they're high risk, especially for upper tract, or do we not have enough data to kind of go there?\n\nWe don't have data. The neoadjuvant data for platinum-based chemotherapy plus immune checkpoint blockade in upper tract disease, the path CR rate is fairly low, and so that does bring some pause to that general approach, but we don't have data in the adjuvant setting. Okay. So now the patient got cell-free DNA, and they used the Signatera test, which is a bespoke assay. Tumor gets sequenced, probes are designed based on the identified mutations. Later on, they get blood drawn, and then the DNA— those specific mutations are looked for in the blood. And there's a lot of data that's been generated showing that this has a lot of prognostic importance. I'd love to ask maybe Dr. Necchi. I know in Italy you don't have as much access to this. Are you able to send an assay like Signatera, or is that harder for you in international?",
    "discourseText": "Adjuvant therapy of muscle-invasive urothelial bladder cancer took a major step forward at the October ESMO meeting when Professor Powells presented the INVIGOR-011 trial, And Dr."
  },
  {
    "id": "gu-canary-04-psma-addition-uromigos",
    "sourceKey": "cecae74c-fd45-4223-92be-b5796e51e0c0:NCT06282588:719352:822065",
    "rowIds": [
      "cecae74c-fd45-4223-92be-b5796e51e0c0:56f4cd45-5466-4909-8eb3-58eb324e12f7:719352:822065"
    ],
    "targetIdentifiers": [
      "NCT06282588"
    ],
    "episode": {
      "title": "Episode 512: ENZA-P Nature Medicine translational data",
      "url": "https://podcasters.spotify.com/pod/show/the-uromigos/episodes/Episode-512-ENZA-P-Nature-Medicine-translational-data-e3l2vfa",
      "show": "The Uromigos",
      "publishedAt": "2026-07-06T06:00:00+00:00"
    },
    "audio": {
      "episodeId": "cecae74c-fd45-4223-92be-b5796e51e0c0",
      "audioUrl": "https://anchor.fm/s/13347ea8/podcast/play/121781162/https%3A%2F%2Fd3ctxlq1ktw2nl.cloudfront.net%2Fstaging%2F2026-5-21%2F426545498-44100-2-e06f88030175b.m4a",
      "startMs": 719352,
      "endMs": 822065
    },
    "contextInterval": {
      "startMs": 704352,
      "endMs": 852065,
      "leadMs": 15000,
      "tailMs": 30000
    },
    "discourseInterval": {
      "startMs": 0,
      "endMs": 719352,
      "leadMs": 1200000,
      "maxChars": 3000
    },
    "text": "Why would that happen biologically? Well, so, so what we're doing is we're taking— I guess we're taking the escape mechanism that the cell is potentially using as a proliferative agent, and then we're targeting that specifically. You know, enzalutamide monotherapy, the increased PSMA expression, it acts along an alternative proliferative growth pathway. We're targeting that PSMA with cetuximab, we're knocking off those cells that have that activated growth pathway. So I think that's why it works really nicely. And one of the things that we also found is that with the PSA 50% response rate, even we got very high PSA 50% response rates in the combination, um, 95%. But if you actually had an increase in PSMA expression, that went up to 98%. So there was some synergy there that we're seeing. Um, but, but I think we're co-targeting in an effective way by, by targeting the growth pathway that that cell will preferentially use if it's got, you know, resistance to Enhertu.\n\nAnd so you go back. Well, it's going to— I mean, and we talked about this a little bit before we started recording about the implications for combination versus monotherapy. Yeah. Right. We have monotherapy data post-chemo, pre-chemo now. Um, we have PSMA-Addition, which these data would suggest should be wildly positive, right? Yes, yeah, because it's a natural space to put a combination of RP plus ADT. Because RP now used up front in hormone-sensitive space, you add in Lutetium, you're rescuing people who may not have done well on—\n\nexcept that, except that, to just go back a step with PSMA-Addition, so this is mCRPC, right? So you can have a lot more patients here who actually have castrate-resistant, you know, androgen resistance in their, in their cell lines, right? So we're going to get more upregulation with this group than we will say in the PSMA-Addition space, because a lot of the PSMA-Addition patients will actually be androgen sensitive, right? They may not have that many clonal populations that are androgen. So this, this PSMA upregulation you think is more pronounced in the castrate resistance?\n\nSo you will get— know that, or do you just think that? Uh, so I haven't done it in— actually, we have got some early data from another trial in, in HTSPC, but we haven't presented that yet. I don't know it, but I— but you think— I think we can see it. So help me with this, because, because the best OS signal we have for lutetium is in the VISION trial, and that's a monotherapy. Yes. And then we've done a whole load of combination trials. All those combination trials have not had as good an OS signal. If there was synergy between the two because of the upregulation you would have expected the better signals to be in the combination, not the monotherapy.\n\nWell, we do have a hazard ratio of 0.549 with this trial. Yeah, but, and vision has zero point, monotherapy has 0.6. Yes. And so, and then, but the combination, you know, the, the frontline trial, we don't really know that OS hazard ratio, or we don't have a full— immature, but it's not 0.5. Well, it's never going to be zero. Also, also, and also, second, there was a study done, wasn't there, where the hazard ratio was greater than one with the combination, wasn't it? No, that was initially in PSMA-Addition. PSMA-4 was the combination of RP plus lutetium?",
    "discourseText": "Um, and we're going to talk about some interesting data published in Nature Medicine from the ENZA-P study.\n\nLouise, I'm going to turn it over to you in a second, but this was a study of Enzalutamide plus minus some Lutetium doses in CRPC, early CRPC.\n\nVincent's Hospital in Sydney, Australia, and the Enzalutamide trial, uh, was a trial really looking at co-targeting the RP and PSMA receptors in early mCRPC.\n\n162 patients randomized between enzalutamide monotherapy and enzalutamide and adaptive dose lutetium PSMA, and the primary endpoint of the trial was PSA-PFS that was positive with a 5-month difference in progression-free survival.\n\nSo fatigue, obviously a side effect of Enzalutamide, when we added the Lutetium PSMA, we actually got a reduction in fatigue at every time point on the trial.\n\nAnd then we did a serial PET study where we did, uh, I did PSMA PET baseline, day 9, day 18, day 28, uh, in patients commencing Enhertu, my previously published."
  },
  {
    "id": "gu-canary-05-ev-302-gucast",
    "sourceKey": "ab11821a-806e-48c7-acdb-1581586b7e02:NCT04223856:1223810:1283130",
    "rowIds": [
      "ab11821a-806e-48c7-acdb-1581586b7e02:00cf0977-355a-47d5-a2fa-d36700a92227:1223810:1283130"
    ],
    "targetIdentifiers": [
      "NCT04223856"
    ],
    "episode": {
      "title": "EV-pembro in localised and advanced bladder cancer - a superb summary!",
      "url": "https://www.buzzsprout.com/904063/episodes/19395025-ev-pembro-in-localised-and-advanced-bladder-cancer-a-superb-summary",
      "show": "GU Cast | Urology Podcast",
      "publishedAt": "2026-06-24T22:00:00+00:00"
    },
    "audio": {
      "episodeId": "ab11821a-806e-48c7-acdb-1581586b7e02",
      "audioUrl": "https://www.buzzsprout.com/904063/episodes/19395025-ev-pembro-in-localised-and-advanced-bladder-cancer-a-superb-summary.mp3",
      "startMs": 1223810,
      "endMs": 1283130
    },
    "contextInterval": {
      "startMs": 1208810,
      "endMs": 1313130,
      "leadMs": 15000,
      "tailMs": 30000
    },
    "discourseInterval": {
      "startMs": 23810,
      "endMs": 1223810,
      "leadMs": 1200000,
      "maxChars": 3000
    },
    "text": "Yeah, I think ideally it all takes place under a trial. Correct. And Matt Galsky's got a bladder preservation study with EV-301 that's ongoing and there's a larger one that Astellas and EV are looking at in terms of collecting some of that, that data. So I think it would be hard in the community to sort of say that that's a standard of care. Correct. No, I don't understand enough about it. Yeah, it's a great paper, um, we'll put a link in the show notes. The optimal management of muscle invasive bladder cancer, led by Shilpa and senior author Ashish Kamat, and it is a great read for an update on all of this fast-moving therapy areas. Andrew, on, on it, EV Pembrol in the perioperative setting, are we expecting to get access the next few months, next year or so here in Australia, just for Australia.\n\nSo unfortunately there's no access to perioperative, um, EV Pembrolizumab here. And what we do have now is now access to EV Pembrolizumab in the metastatic setting. And that's— so that's exciting news. Just this week there's an access program for EV. We already had access to Pembrolizumab for free. So all patients in the metastatic setting and first line, building on really good data from EV-302 now have access. And that was previously funded by patients if they could afford it. And the difference there is quite stark, obviously.\n\nWell, let's dive into that because that's the second part of the podcast. We want to talk about metastatic bladder cancer because again, that's been an area that was so grim for so long, René, wasn't it? And then it was the— I mean, stuff was happening, but it was when EV-302 read out, when Tom Powells read it out at ESMO, And we had a podcast right here with Andrew. Yeah, and we did. Yeah, we had Enrique Grande here in the studio around that time. What was that, only about a year and a half ago or two years ago?\n\nSomething like that. Soon after that came out. And you were involved in EV-302. So just, just for listeners and viewers, can you just remind us a bit about the EV-302 trial? And it will be recorded as one of the landmark trials in bladder cancer. Sure. So this was a large randomized study that looked at the combination in first-line metastatic patients with either upper tract or bladder urothelial cancer. And so these was a patient population randomized to either platinum-based chemotherapy with Cisplatin or Carboplatin with Gemcitabine, and they were randomized to EV-301. Some of the patients who received the platinum-based chemotherapy went on and had maintenance of Avelumab. So you recall from the Javelin study, that was a standard of care in some centers, in some parts of the world had access but that wasn't mandated. Now, the study was strikingly positive for all events. You know, we had a response rate which was close to, you know, over 60%, a path response rate approaching about 30% or so, you know, a complete response rate, sorry, of 30%. And we see these really durable responses in patients with EV- Pembrolizumab, that combination. And that, that's strikingly different to that platinum-based chemotherapy where we would see responses, but for the majority of patients they would progress within, you know, 4 to 10 months or so, even if they had initial downstaging and response with treatment. With EV-301, my experience is a patient gets a response, it's often very durable, long-lasting, and some of that updated data presented at ASCO is quite striking in terms of the survival, you know, out to, you know, multiple years of follow-up now that patients who had Apaccea, you know, their survival is over 88% or something.",
    "discourseText": "And Shilpa, we might ask you to expand on it a bit because I suppose it was the EV-303 trial, uh, recently published in New England Journal, and we interviewed Christoph Feldstucke about that a few months ago, actually, when we caught up with Christoph in Singapore.\n\nSo remind us a bit about the EV-303 study.\n\nLike Andrew said, you know, we first had the EV-302, which changed the paradigm for locally advanced metastatic urothelial cancer, large trial for the first time, you know, beating platinum in the metastatic setting.\n\nBecause we had the Niagara trial that, that read out a couple of years ago by Tom Powells at ESMO, and it showed that the addition of perioperative Dabolumab can improve survival in addition to neoadjuvant chemotherapy.\n\nI think the NIVRA trial was the first in the space to show that addition of perioperative immunotherapy led to improved survival.\n\nBut, you know, I think if you have a look at the outcomes in terms of that path CR rate comparing cross-trial comparison, of course not being optimal, but that path CR rate of, you know, if you have a look in EV-304, for instance, in patients that went to surgery, it was as high as 64%, you know, path CR rate.\n\nAnd I think what we learned from these two trials, like you said, Renu, you know, in the CIS ineligible patients, it was 3 followed by 6 cycles.\n\nIn fact, a trial called EV-309 has been launched where Patients will get 9 cycles of EV Pembrolizumab, and the experimental arm is just to watch them versus trimodality.\n\nAnd there are some interesting trials like VOLGA which are coming out this year that might help answer that, that question.\n\nAnd I think in this paper also we talk about like how to define clinical complete response because we are not there yet to say somebody, you know, in the RETAIN trial, a lot of patients had recurrences, so we're not very good at identifying those patients.\n\nAnd Matt Galsky's got a bladder preservation study with EV-301 that's ongoing and there's a larger one that Astellas and EV are looking at in terms of collecting some of that, that data."
  },
  {
    "id": "gu-canary-06-talapro-3",
    "sourceKey": "b9e53b25-370f-4c69-90d0-3f2ea05957ac:NCT04821622:1113050:1195170",
    "rowIds": [
      "b9e53b25-370f-4c69-90d0-3f2ea05957ac:8276ab02-4ef1-4d66-b5c5-2749cc75f759:1113050:1195170"
    ],
    "targetIdentifiers": [
      "NCT04821622"
    ],
    "episode": {
      "title": "Episode 509: ASCO 2026 Review",
      "url": "https://podcasters.spotify.com/pod/show/the-uromigos/episodes/Episode-509-ASCO-2026-Review-e3kfc9g",
      "show": "The Uromigos",
      "publishedAt": "2026-06-08T07:00:00+00:00"
    },
    "audio": {
      "episodeId": "b9e53b25-370f-4c69-90d0-3f2ea05957ac",
      "audioUrl": "https://anchor.fm/s/13347ea8/podcast/play/121138928/https%3A%2F%2Fd3ctxlq1ktw2nl.cloudfront.net%2Fstaging%2F2026-5-7%2F425687559-44100-2-9effe48080a3c.m4a",
      "startMs": 1113050,
      "endMs": 1195170
    },
    "contextInterval": {
      "startMs": 1098050,
      "endMs": 1225170,
      "leadMs": 15000,
      "tailMs": 30000
    },
    "discourseInterval": {
      "startMs": 0,
      "endMs": 1113050,
      "leadMs": 1200000,
      "maxChars": 3000
    },
    "text": "Yeah, I think it would be interesting, especially when these patients come through urologists. Yeah, go ahead, sorry. Yeah, and also, Tom, I asked you once and you, even you were not so very sure which patients you would treat that way. And then I guess— When you say even me, you're suggesting that I'm trying to give it or is it what? I don't, you know, I don't know. Usually you are very sure about what you will do or not do. All right, Silke, we're going to jump to prostate highlight of the meeting, plenary session. So, and we talked a little bit about this in the preview, but talk to us about it.\n\nI think, Brian, if it's a prostate, Silke should say what the highlight of the meeting is. No, I was just— Wouldn't you agree with that, Silke? Talk to us about the highlights. Yes, Brian, fantastic. Silke, could I ask you a question before we start? Do you think, for you, that the TALAPRO-3 which was the PARP data, or the Proteus data was more impactful, was a better, more— which was for you? I know one was chosen as a plenary, because I think some people, including myself, when you get a plenary, you know, you think, oh, that must be the best. But I— what do you, what did you think? What did you think?\n\nYou know, I think the TALAPRO-3 is kind of a me too, because Amplitude is out, but it's better than Amplitude, isn't it? Did you think it was better data? Yeah, novel for you, and that's why. Okay, no, I think we discussed even, you know, it. And also it's not a very clean control arm because a lot of these patients should have had, in my opinion, Docetaxel, and they didn't get it. It's not a super clean study. It's not like Amplitude. It's much— Amplitude was much cleaner, in my opinion. So, so I, I don't think TALAPRO-3 should have made it to the plenary. If anything, but again, I'm super biased, I would have put Reduce in the plenary.\n\nOkay, so before we get to Reduce, why don't we go through the Proteus and the TALAPRO-3? You've talked a little bit about TALAPRO-3, which is, I think, you know, I think it was for me, I was quite impressed in with the data in the non-bracker HRR population. Yeah, I agree. I agree. I agree with that. Do you think that's just the vagaries of trial design, or is it a different PARP inhibitor and therefore the ATM patients are benefiting, etc.? Yeah, so the ATM patients or the patients with ATM alterations were not even allowed in AMPLITUDE because they— we hadn't shown a lot of effect in these patients in the mCRPC setting, if you remember. So, so I mean, for me now it's quite unclear what to do with these patients with ATM that had in the subgroup analysis seem to profit from the combination Enzalutamide and Talaproxib. So I think it's quite interesting.",
    "discourseText": "You know, it's not a randomized trial, but we're beginning to see that these other class of drugs, this newer class, Nectin-4, TOPA-1, has really nice activity.\n\nThe AMBASSADOR study, Pembrolizumab versus placebo, perhaps some small difference in long-term fatigue, but no real difference.\n\nAnd there are studies like KEYNOTE-992, and Brian, you— I think you and I chatted about this before, which is doing— that's a radiotherapy trial of TMT, chemo radiation, versus that with Pembrolizumab.\n\nAnd so if it's not doing anything in ALBUM in local disease, that study should have been wildly positive."
  },
  {
    "id": "gu-canary-07-ev-302-uromigos",
    "sourceKey": "974f3268-b6ee-40b8-93d7-87149db117ef:NCT04223856:8609:69980",
    "rowIds": [
      "974f3268-b6ee-40b8-93d7-87149db117ef:00cf0977-355a-47d5-a2fa-d36700a92227:8609:69980"
    ],
    "targetIdentifiers": [
      "NCT04223856"
    ],
    "episode": {
      "title": "Episode 504: ASCO 2026 - ADC Drug Development in Urothelial Cancer",
      "url": "https://podcasters.spotify.com/pod/show/the-uromigos/episodes/Episode-504-ASCO-2026---ADC-Drug-Development-in-Urothelial-Cancer-e3jsa4o",
      "show": "The Uromigos",
      "publishedAt": "2026-05-29T22:30:00+00:00"
    },
    "audio": {
      "episodeId": "974f3268-b6ee-40b8-93d7-87149db117ef",
      "audioUrl": "https://anchor.fm/s/13347ea8/podcast/play/120514136/https%3A%2F%2Fd3ctxlq1ktw2nl.cloudfront.net%2Fstaging%2F2026-4-25%2F424851413-44100-2-cf14be68f94d8.m4a",
      "startMs": 8609,
      "endMs": 69980
    },
    "contextInterval": {
      "startMs": 0,
      "endMs": 99980,
      "leadMs": 15000,
      "tailMs": 30000
    },
    "discourseInterval": {
      "startMs": 0,
      "endMs": 8609,
      "leadMs": 1200000,
      "maxChars": 3000
    },
    "text": "Hey everyone, welcome to another Your Amigos ASCO 2026 podcast. This one is on antibody-drug conjugates in urothelial cancer. We're pleased to be joined by Gopal Iyer, who presented some data about a novel ADC in bladder cancer, and we're going to use that data as an opportunity to, to broaden the scope and talk about the EV-302 update that I'm going to ask Tom to do, talk about that data, and then talk generally about sequencing of ADCs and novel ADCs and some other data at ASCO. So Gopa, I'll turn it over to you for a sec to introduce yourself, uh, and then we'll get going.\n\nSo much, Brian and Tom. Uh, this is Gopa Iyer. I'm a, uh, GU medical oncologist at Memorial Sloan Kettering Cancer Center. Um, have a, a lot of interest in, uh, urothelial cancer translational research, um, and some of the new, uh, treatment modal Thanks for inviting me. Yeah, we appreciate you joining. All right, so Tom, we're going to start with you. EV-302 presented an update. I think it was a 3.5-year update. So why don't you take us through a little bit of that data, and then we have some questions for you.\n\nSo for those that have been on holiday for the last 3 or 4 years or in space travel, Ipilimumab vedotin and Pembrolizumab is a combination which has been really successful in urothelial cancer. And EV-301 was single-agent therapy. Which showed actually pretty good response rates in heavily pretreated patients, but there wasn't a huge amount of durability. But for some reason, and we haven't got to the bottom of it quite yet, when you put EV-pembrolizumab together in the frontline setting, you get much higher responses and you appear to get more durability than we expected. And so, the original EV-302 publication, Enfortumab vedotin, which is a Nectin-4 ADC with MMAE payload, pembrolizumab, obviously is PD-1 inhibitor, until progression of disease. So many patients were on therapy for a long period of time. That was the study arm. The control arm, platinum chemotherapy in frontline metastatic urothelial cancer, previously untreated. About 30% of patients in the key— in fact, in the end, about 60% of patients who progressed in the chemotherapy arm ended up getting immune therapy. So quite high proportions of patients there. It was a big positive randomised trial, doubling in progression-free survival, doubling overall survival, 30% CR rate, 70% response rate. And here we presented the 3.5-year data update. And essentially, that showed more of the same from an efficacy perspective. So the OS hazard ratio remained 0.53, which is really impressive. It seems to be plateauing at 4 years. It's about probably going to end up being about 40% 5-year survival. On the first trials that we did back in the day, you know, we were looking at 5 or 10% 5-year survival. So it's a huge shift in that respect, which I think is fabulous.",
    "discourseText": ""
  },
  {
    "id": "gu-canary-08-keynote-564",
    "sourceKey": "a1c1b2ee-7ac1-4e72-ab6b-3194d307a8c8:NCT03142334:3025290:3107010",
    "rowIds": [
      "a1c1b2ee-7ac1-4e72-ab6b-3194d307a8c8:22aa8513-ee3d-4715-a786-96dac2bd6517:3025290:3107010"
    ],
    "targetIdentifiers": [
      "NCT03142334"
    ],
    "episode": {
      "title": "Navigating Urologic Cancer Care Across the Map: Getting up to Speed on the Latest Systemic Therapies for Renal Cell Carcinoma and Advanced Urothelial Carcinoma",
      "url": "https://answersincme.com/860/240201307-replay3",
      "show": "CME in Minutes: Education in Oncology & Hematology",
      "publishedAt": "2026-04-23T23:00:00+00:00"
    },
    "audio": {
      "episodeId": "a1c1b2ee-7ac1-4e72-ab6b-3194d307a8c8",
      "audioUrl": "https://answersincme.com/240201307-4240201307-replay3.mp3?ProjectNumber=240201307-4&#x26;Promocode=861&#x26;AudienceID=AICME",
      "startMs": 3025290,
      "endMs": 3107010
    },
    "contextInterval": {
      "startMs": 3010290,
      "endMs": 3137010,
      "leadMs": 15000,
      "tailMs": 30000
    },
    "discourseInterval": {
      "startMs": 1825290,
      "endMs": 3025290,
      "leadMs": 1200000,
      "maxChars": 3000
    },
    "text": "No, but I mean, in oncology in general, there's a lot of talk about circulating tumor DNA. We've been talking about it for a time for detecting earlier recurrence, for adjusting doses, for giving— being able to safely, comfortably give patients a chemo holiday. So, um, for deciding who even requires how much adjuvant and dose intensity in metastatic. So there's— I think that will— there's so much, um, research in that area. I think it's not prime time, but I, I think that we continue to have a lot of momentum in that area.\n\nDefinitely. I'm a big fan of the MRD for ctDNA, and that's again tumor-informed to capture if there's recurrence. And there are data out there looking at ctDNA changes to dictate dosing of EV. So yeah, as you say, it might come, but for now, I think it's the good old clinical assessment, history, physical labs, and then what we do day to day, which is assessing people and their side effects. Okay, that was a great conversation to start, and we can certainly get to questions if folks have them later. Let's pivot to kidney cancer. Let's start with the resected setting, the adjuvant setting. We've had a long journey here, Dorothy, talking about this and working with our multi-D colleagues like our urologists who do the nephrectomies. But let's focus on the referrals you might get, and we can broaden this up into what that has been looking like pattern-wise over the last several months. But are clinicians considering adjuvant IO, or at least in your clinic or others, in all eligible patients that meet indication for a drug, or do you think there's more selectivity? I think the question here is around the PT2 high-grade and PT3 low-grade. These are ones that would be in the intermediate high-risk for the KEYNOTE-564 trial. But are you getting a sense that it's being discussed with all patients who are eligible, or is there picking and choosing, and where is that happening?\n\nIt's hard to know because from the position of a medical oncologist I really don't know the denominator. I would certainly say that more of the referrals are higher risk or greater burden of resected disease, but it's hard to know what led up to that. Was it that the patient and urologists were thinking that there was lower burden disease and the patient may be less motivated? I'm not really sure what led to that, but certainly there is a range of patients who would fit the pathology eligibility criteria of the KEYNOTE-564. Um, the numbers, I, I'm thinking that they're pretty stable in terms of, you know, when we started prescribing adjuvant IO till now. Um, but again, I'm not sure really what the denominator is. Um, so a range of patients that are being referred in terms of the pathology eligibility criteria, um, would say, um, most, most patients, if they're being referred, they know what they're being referred for. They have already been told that they're being considered for adjuvant treatment, immunotherapy. Most patients are interested, not all patients. Then I think that's fair. Even sitting here, is it all patients who are getting it? Even patients who all fit the pathology eligibility criteria, like all of us in this field, we consider fitness level, comorbidities, age, competing factors, functional status, patients' preferences and goals. Um, so I would say in general, um, I'm— my sense is that most patients are referred, certainly those with more resected, higher burden on that scale or continuum. And then most patients who are referred are interested, and most would opt to take adjuvant treatment?",
    "discourseText": "The KEYNOTE-564 trial, which evaluated Pembrolizumab versus an adjuvant placebo, looked at patients with certain risk groups.\n\nWe have now had 5-year follow-up data from that pivotal trial I mentioned, KEYNOTE-564, and here you can see the Kaplan-Meier curve of DFS benefit.\n\nBut nevertheless, the KEYNOTE-564 trial did show that again, at a landmark of 5 years, an improvement in overall survival at that landmark of about 5%, which has a number needed to treat of about 20.\n\nThe RAMPART trial, which was run out of a group in the UK and in Europe, looked at a phase 3 randomized 3:2:2 trial of patients receiving either active monitoring, Durvalumab as a PD-L1 agent for 1 year, or Durvalumab plus Tremelimumab at a dose-adapted strategy, also receiving the Durvalumab for 1 year and 2 doses of Tremelimumab.\n\nI think it's important to point out that this doesn't exactly tie, um, precisely with the risk categorization in the KEYNOTE-564 trial, meaning if you look at a PT2, or grade 4 lesion here by Leibovitch, this would be at least a high-risk, uh, patient, whereas that was intermediate high in the KEYNOTE-564 data.\n\nMore recently at GUASCO, we had the readout from the LightSpark-022 trial.\n\nThis was the kind of building-upon study from KEYNOTE-564, where in this case, patients with the similar T-stage risk groups were randomized to receive Pembrolizumab and placebo or Pembrolizumab and Beizutifan, a HIF2 alpha blocker.\n\nIn this case, there was a slightly different definition of M1NED, but otherwise a fairly similar trial in terms of eligibility criteria.\n\nSo first line for RCC, not the main point of debate today, but I've just shown on the right the Nivo-Ipi-Cabo, a triplet study from COSMIC-313.\n\nAs I mentioned before, we've had the LightSpark 005 trial looking at Belzutifan versus Everolimus, a historic standard of care, not currently used very commonly now.\n\nSo at ASCO GU, we had the readout of the LightSpark 11 trial.\n\nVery briefly, this was a trial evaluating Cabozantinib, a very good control arm, against Belzutifan plus Lenvatinib in advanced RCC patients, all of whom had prior immunotherapy.\n\nThe LightSpark-012 trial should be reading out at some point in later '26 or early '27.\n\nI'm going to say that we don't have a perfect answer for this one, Dorothy, but are there any biomarkers to predict response to EV We saw initially data around Nectin-4 when they broke down expression of Nectin-4 in some of the formative pivotal trials."
  },
  {
    "id": "gu-canary-09-keynote-b15",
    "sourceKey": "31e431b9-5581-448d-987c-c1058bbb420c:NCT04700124:8443:57282",
    "rowIds": [
      "31e431b9-5581-448d-987c-c1058bbb420c:cd483e57-9ef4-426b-9e04-bfe5c3f664ac:8443:57282"
    ],
    "targetIdentifiers": [
      "NCT04700124"
    ],
    "episode": {
      "title": "ASCO GU26 special: Prof. Galsky on results of the KEYNOTE-B15 study",
      "url": "https://www.buzzsprout.com/1555850/episodes/18760206-asco-gu26-special-prof-galsky-on-results-of-the-keynote-b15-study",
      "show": "EAU Podcasts",
      "publishedAt": "2026-03-01T00:00:00+00:00"
    },
    "audio": {
      "episodeId": "31e431b9-5581-448d-987c-c1058bbb420c",
      "audioUrl": "https://www.buzzsprout.com/1555850/episodes/18760206-asco-gu26-special-prof-galsky-on-results-of-the-keynote-b15-study.mp3",
      "startMs": 8443,
      "endMs": 57282
    },
    "contextInterval": {
      "startMs": 0,
      "endMs": 87282,
      "leadMs": 15000,
      "tailMs": 30000
    },
    "discourseInterval": {
      "startMs": 0,
      "endMs": 8443,
      "leadMs": 1200000,
      "maxChars": 3000
    },
    "text": "Welcome to the EAU Podcast. Good morning, everyone. It's my pleasure to be at ASCOGEO in San Francisco this year. Today we have the honor to be with Professor Galsky from Mount Sinai, New York. And Professor Galsky just have presented a very, very awaited study, the KEYNOTE-B15, talking about EV Pembrol in the perioperative settings in patients that are CIS eligible. Matthew, thank you very much for your time. Thank you. Thanks for having me. We are very happy to have you. Can you tell us a bit before we go through the design and the results of the, of the trial, can you tell us what is the rationale behind this trial?\n\nSo Enfortumab vedotin plus Pembrolizumab is now standard treatment for patients with metastatic urothelial cancer since the EV-302 study. And because of the activity and safety in patients with metastatic disease, it was quite logical to move that to the perioperative setting where frankly we've had no major improvements in treatment since this plant-based chemotherapy was shown to be beneficial almost 25 years ago. Um, and so B15 was designed— KEYNOTE-B15, which was the study that I presented— and then SISTER study, KEYNOTE-905. These were asking complementary questions. B15, is this regimen of, uh, clinical utility in patients who are cisplatin eligible versus cisplatin-based neoadjuvant chemotherapy? In KEYNOTE-905, is this regimen of clinical utility in patients with muscle invasive bladder cancer or cisplatin ineligible where cystectomy alone would be standard of care?",
    "discourseText": ""
  },
  {
    "id": "gu-canary-10-keynote-905",
    "sourceKey": "0670372f-be3e-46a7-ba6a-dfa018202c11:NCT03924895:7734:178710",
    "rowIds": [
      "0670372f-be3e-46a7-ba6a-dfa018202c11:76df5272-4fba-40b3-b689-32602481f21a:7734:178710"
    ],
    "targetIdentifiers": [
      "NCT03924895"
    ],
    "episode": {
      "title": "Periop EV-Pembro | Do we even need cystectomy anymore?? EV-303 with Christof Vulsteke",
      "url": "https://www.buzzsprout.com/904063/episodes/18741597-periop-ev-pembro-do-we-even-need-cystectomy-anymore-ev-303-with-christof-vulsteke",
      "show": "GU Cast | Urology Podcast",
      "publishedAt": "2026-02-24T19:00:00+00:00"
    },
    "audio": {
      "episodeId": "0670372f-be3e-46a7-ba6a-dfa018202c11",
      "audioUrl": "https://www.buzzsprout.com/904063/episodes/18741597-periop-ev-pembro-do-we-even-need-cystectomy-anymore-ev-303-with-christof-vulsteke.mp3",
      "startMs": 7734,
      "endMs": 178710
    },
    "contextInterval": {
      "startMs": 0,
      "endMs": 208710,
      "leadMs": 15000,
      "tailMs": 30000
    },
    "discourseInterval": {
      "startMs": 0,
      "endMs": 7734,
      "leadMs": 1200000,
      "maxChars": 3000
    },
    "text": "So really huge news in bladder cancer with what promises to be a landmark publication just released in the New England Journal of Medicine this week. It's the results of the perioperative EV Pembrolizumab trial known as EV-303 or KEYNOTE-905. This has already made headlines as it was presented in the presidential plenary at ESMO a few months ago by first author Christoph Wolszczeki. Well, myself and Declan caught up with Christoph recently when we were in Singapore for ESMO Asia, and we talked about this very significant paper. Enjoy.\n\nSo for this very special themed podcast supported by our platinum partners, Astellas, we're not at home in Melbourne, Ranu. No, no, it's a big meeting, ESMO Asia. Great to be here in Singapore. Yeah. And we just walk around and run into total superstars. Yes. So it's a huge, huge honor to welcome our colleague, Professor Christoph Felstücki from Ghent in Belgium from the Integrated Cancer Center in Ghent, and you work at the University of Antwerp as well. But Christophe, great to have you join us on the podcast.\n\nThank you for having me. It's a flying visit for you, Christophe. You're in and out, giving a very important presentation and then heading off again. Yes, one day sleep here and it's the other side of the world for me, so it's quite exhausting. And now you know how we feel when we come to Europe. Yes, and I still have to come to Australia too. You do, you do. You have to make the trip down under for sure. So the reason we're sitting down for this dedicated quick episode with Christoph is because, of course, at ESMO recently in Berlin, in the presidential session, the presidential plenary, Christoph read out the data from the KEYNOTE-905 EV-303 trial, which made huge headlines around the world. The full paper actually hasn't been published yet from this, I think, which will be coming. But already this is provoking huge excitement for anybody looking after muscle invasive bladder cancer. And it's following on, Renaud, isn't it, on other data which will change the way we approach muscle invasive bladder cancer. From old-fashioned neoadjuvant chemo to this new neoadjuvant/perioperative immunotherapy approaches to bladder cancer. And that's what we're going to speak to Christoph about today.\n\nYeah, absolutely. I mean, back-to-back big bladder cancer trials at ESMO. You know, remember Niagra being presented at ESMO 2024, and I still remember Jim Catto saying, you know, it'll be great when this EV-301 trial reads out because again, it's addressing a very high-risk population and a big area of need. And lo and behold, a year later, KEYNOTE-905 is read out. Okay, so if you know nothing about that, just stay tuned to this episode sort of GU cast, and we're going to pick Christof Springs. But I suppose, Christof, before you tell us a bit about the trial, and you're here reprising it at this ESMO meeting, ESMO Asia meeting, your thoughts a little bit on the background to immuno-oncology and bladder cancer, and why I suppose you set this trial up, and then tell us a bit about EV-303, KEYNOTE-905.\n\nYeah, and just one comment on the paper. I hope it will be a Christmas present. It's upcoming, it's in the last stages, so it will be there soon. It all started, I think, when we presented was the lead author there was Tom Powell then in 2023 in the metastatic space. When you went to bladder cancer conferences, they didn't change a lot, some months here, some months there. But when we saw then the combination, the registration of Phase 3 trial, the TROP-2 in the metastatic space with Enfortumab vedotin and Pembrolizumab, so combining antibody-drug conjugate together with checkpoint inhibition, and with a doubling of the progression-free survival, a doubling of the overall survival, and 30% had a complete response. And after 2 years, 75% of these patients are still in a complete and I have this patient, I was very active in that trial, and I have still that patient after 4 to 5 years that's still free of disease that started with metastatic lung mets, liver mets, and this was remarkable. So based on these results and also the EV-103, we added that third arm in our trial, the KEYNOTE-905. It would be mad not to introduce this trial, and we said if we can move this very powerful regimen earlier in stage, it will hopefully cure even more patients. So that was a bit the background, the EV-302 trial, EV-103, and that combination was very active and we wanted to put it in preoperative space.",
    "discourseText": ""
  }
] as CanaryTranscriptWindow[];

export const CANARY_SOURCE_PACK_RECEIPT = {
  schemaVersion: "podcast-evidence-development-smoke-source-pack-v1.0.0",
  runType: "production_canary_10",
  area: "GU",
  windowCount: LOCAL_CANARY_TRANSCRIPT_WINDOWS.length,
  completeness: "bounded-windows-not-complete-transcripts",
} as const;
