
import { useEffect, useState } from "react";
import "./App.css";

const API = "http://127.0.0.1:8000";

const moduleDescriptions = {
  skin: "Skin image classification and explainability",
  brain: "Brain MRI analysis module",
  retina: "Diabetic retinopathy image analysis",
  lung: "Lung medical-imaging analysis",
};

const SKIN_DISEASE_INFO = {
  akiec: {
    title: "Actinic keratoses / intraepithelial carcinoma (AKIEC)",
    overview:
      "This model class groups actinic keratoses and some intraepithelial carcinomas. These are sun-damage-related lesions that may need clinical assessment.",
    signs:
      "They can appear as rough, scaly, crusted, or persistently changing patches. Images alone cannot confirm the condition.",
    nextSteps:
      "Arrange assessment by a qualified clinician, especially for a persistent, growing, bleeding, tender, or changing lesion.",
  },
  bcc: {
    title: "Basal cell carcinoma (BCC)",
    overview:
      "Basal cell carcinoma is a type of skin cancer that often grows slowly. Early professional assessment helps determine appropriate care.",
    signs:
      "It may look like a pearly bump, a non-healing sore, or a pink patch; it can also bleed or crust.",
    nextSteps:
      "Arrange an appointment with a dermatologist or qualified healthcare professional for evaluation.",
  },
  bkl: {
    title: "Benign keratosis-like lesion (BKL)",
    overview:
      "This category includes several usually non-cancerous keratosis-like skin lesions. The model category does not establish a definitive diagnosis.",
    signs:
      "Lesions may be waxy, rough, scaly, or raised, and their appearance can overlap with other skin conditions.",
    nextSteps:
      "Seek clinical review if the lesion is new, changing, irritated, bleeding, or looks different from your other spots.",
  },
  df: {
    title: "Dermatofibroma (DF)",
    overview:
      "A dermatofibroma is commonly a benign, firm skin nodule. A clinician can distinguish it from other lesions when needed.",
    signs:
      "It may appear as a small, firm, brownish or pink bump, often on the legs.",
    nextSteps:
      "Ask a healthcare professional to assess it if it changes, hurts, bleeds, or if you are uncertain about the spot.",
  },
  mel: {
    title: "Melanoma (MEL)",
    overview:
      "Melanoma is a potentially serious form of skin cancer. A model prediction is not confirmation, but this result warrants timely professional assessment.",
    signs:
      "Warning signs can include asymmetry, irregular borders, multiple colours, change in size or appearance, or a spot that differs from others.",
    nextSteps:
      "Arrange prompt assessment with a dermatologist or qualified clinician. Do not delay care while relying on this AI result.",
  },
  nv: {
    title: "Melanocytic nevus (NV)",
    overview:
      "A melanocytic nevus is commonly called a mole and is often benign. However, the model cannot determine whether an individual mole is safe.",
    signs:
      "Moles may be flat or raised and vary in colour and size. Pay attention to a new or changing spot, irregular borders, varied colours, or bleeding.",
    nextSteps:
      "Have new, changing, bleeding, or otherwise concerning moles checked by a qualified healthcare professional.",
  },
  vasc: {
    title: "Vascular lesion (VASC)",
    overview:
      "This category covers vascular skin lesions, which involve blood vessels and can have different causes.",
    signs:
      "They may look red, purple, or bluish, or appear as visible blood-vessel-like marks.",
    nextSteps:
      "Seek clinical assessment if the spot is new, changing, bleeding, painful, or if you are unsure what it is.",
  },
};

function getSkinDiseaseInfo(result) {
  if (!result) return null;

  const candidates = [
    result.class_key,
    result.class_code,
    result.predicted_class,
    result.disease_name,
  ]
    .filter(Boolean)
    .map((value) => String(value).trim().toLowerCase());

  const aliases = {
    akiec: [
      "akiec",
      "actinic keratosis",
      "actinic keratoses",
      "intraepithelial carcinoma",
    ],
    bcc: ["bcc", "basal cell carcinoma"],
    bkl: [
      "bkl",
      "benign keratosis",
      "seborrheic keratosis",
      "keratosis-like",
    ],
    df: ["df", "dermatofibroma"],
    mel: ["mel", "melanoma"],
    nv: [
      "nv",
      "melanocytic nevus",
      "melanocytic naevus",
      "nevus",
      "naevus",
      "mole",
    ],
    vasc: ["vasc", "vascular lesion", "angioma"],
  };

  for (const [key, terms] of Object.entries(aliases)) {
    if (
      candidates.some((candidate) =>
        terms.some(
          (term) => candidate === term || candidate.includes(term)
        )
      )
    ) {
      return SKIN_DISEASE_INFO[key];
    }
  }

  return null;
}

/*
 * Educational report recommendations only.
 * These recommendations do not establish a clinical diagnosis.
 */
function getReportRecommendations(module, prediction, skinInfo) {
  const result = String(prediction || "").trim().toLowerCase();

  if (module === "skin") {
    const items = [];
    let urgency =
      "Seek prompt clinical assessment if the lesion is rapidly changing, bleeding, painful, or not healing.";

    if (skinInfo?.nextSteps) {
      items.push(skinInfo.nextSteps);
    } else {
      items.push(
        "Arrange an in-person assessment of the affected skin area with a qualified healthcare professional."
      );
    }

    if (
      result.includes("melanoma") ||
      result === "mel" ||
      result.includes("basal cell carcinoma") ||
      result === "bcc" ||
      result.includes("intraepithelial carcinoma") ||
      result.includes("actinic keratos")
    ) {
      items.push(
        "Arrange timely professional assessment. The AI classification cannot confirm or exclude skin cancer."
      );
      urgency =
        "Contact a qualified healthcare professional promptly about this result. Do not delay assessment while relying on the AI output.";
    } else if (
      result.includes("nevus") ||
      result.includes("naevus") ||
      result.includes("mole") ||
      result === "nv"
    ) {
      items.push(
        "Monitor for changes in size, shape, border, colour, or symptoms, and show any concerning changes to a clinician."
      );
    } else if (result.includes("vascular") || result === "vasc") {
      items.push(
        "Ask a clinician to assess the lesion if its cause is uncertain, or if it changes, becomes painful, or bleeds."
      );
    } else if (
      result.includes("dermatofibroma") ||
      result === "df"
    ) {
      items.push(
        "Seek review if the spot changes, becomes painful, bleeds, or has not previously been assessed."
      );
    } else {
      items.push(
        "Record any noticeable changes and follow the clinician's advice about examination or further testing."
      );
    }

    items.push(
      "Do not attempt to remove, cut, or treat the lesion based solely on the model prediction."
    );

    return {
      title: "Recommended Next Steps",
      items,
      urgency,
    };
  }

  if (module === "brain") {
    const isNoTumor =
      /\b(no[\s_-]*tumou?r|without[\s_-]*tumou?r|normal|notumor)\b/i.test(
        result
      );

    const isTumorLabel =
      /\b(glioma|meningioma|pituitary|tumou?r|neoplasm)\b/i.test(
        result
      );

    if (isNoTumor) {
      return {
        title: "Recommended Next Steps",
        items: [
          "Have the MRI and AI-generated result reviewed by the treating clinician.",
          "If symptoms persist or worsen, discuss them with the clinician even if the model predicts no tumour.",
          "Follow the clinician's advice about further investigations or follow-up imaging.",
        ],
        urgency:
          "A model result that reports no tumour does not rule out disease. Seek emergency care for a seizure, sudden severe headache, new weakness, difficulty speaking, confusion, loss of consciousness, or sudden vision changes.",
      };
    }

    if (isTumorLabel) {
      return {
        title: "Recommended Next Steps",
        items: [
          "Arrange a timely consultation with a neurologist or neurosurgeon to review the original MRI and the AI-generated finding.",
          "Ask the treating specialist whether additional imaging, other tests, or tissue diagnosis is appropriate.",
          "Discuss management options only after a qualified clinician has assessed the findings and clinical history.",
          "Tell the clinician about any headaches, seizures, vision changes, weakness, or other symptoms, if present.",
        ],
        urgency:
          "Seek emergency care for a first seizure, sudden severe headache, new weakness, difficulty speaking, confusion, loss of consciousness, or sudden vision changes.",
      };
    }

    return {
      title: "Recommended Next Steps",
      items: [
        "Arrange a clinician review of the original MRI and the AI-generated result.",
        "Discuss the patient's symptoms and medical history with the treating clinician.",
        "Follow the clinician's advice about further investigations or follow-up.",
      ],
      urgency:
        "Seek urgent medical assessment for new or worsening neurological symptoms.",
    };
  }

  if (module === "lung") {
    const isNoCancer =
      /\b(no[\s_-]*cancer|without[\s_-]*cancer|negative|no[\s_-]*malignancy)\b/i.test(
        result
      );

    const isCancerDetected =
      !isNoCancer &&
      /\b(cancer|malignan|positive|tumou?r|neoplasm)\b/i.test(result);

    if (isCancerDetected) {
      return {
        title: "Recommended Next Steps",
        items: [
          "Arrange timely review of the original lung image and AI output with a qualified healthcare professional.",
          "The model output does not confirm cancer. Appropriate clinical assessment and diagnostic testing may be required.",
          "Discuss the patient's symptoms, medical history, and recommended follow-up with the treating clinician.",
        ],
        urgency:
          "Arrange timely professional assessment. Seek urgent medical care for severe or rapidly worsening breathing difficulties, chest pain, or other serious symptoms.",
      };
    }

    return {
      title: "Recommended Next Steps",
      items: [
        "Have the original lung image and AI-generated result reviewed by a qualified healthcare professional.",
        "A result of no cancer detected does not rule out cancer or other lung conditions.",
        "Follow the treating clinician's advice about further assessment or follow-up testing.",
      ],
      urgency:
        "Do not use a negative model output to delay medical assessment if symptoms or clinical concerns persist.",
    };
  }

  if (module === "retina") {
    return {
      title: "Recommended Next Steps",
      items: [
        "Have the retinal image and AI-generated result reviewed by a qualified eye-care professional.",
        "Discuss visual symptoms, diabetes history, and previous retinal examinations with the treating clinician.",
        "Follow the clinician's advice regarding retinal examination and follow-up.",
      ],
      urgency:
        "Seek urgent eye care for sudden vision loss, a sudden increase in floaters, or sudden flashes of light.",
    };
  }

  return {
    title: "Recommended Next Steps",
    items: [
      "Have the relevant images reviewed by a qualified healthcare professional.",
      "Discuss symptoms and medical history with the treating clinician.",
      "Follow the clinician's recommendations for further testing or follow-up.",
    ],
    urgency:
      "Do not use an AI model output as a substitute for clinical assessment.",
  };
}

function imageDataUrl(value) {
  if (!value) return "";

  if (
    value.startsWith("data:") ||
    value.startsWith("blob:") ||
    value.startsWith("http://") ||
    value.startsWith("https://")
  ) {
    return value;
  }

  return `data:image/png;base64,${value}`;
}

function getScorePercent(result) {
  if (!result) return null;

  const value =
    result.confidence_percent ??
    (result.model_score != null
      ? Number(result.model_score) * 100
      : null);

  if (value == null || !Number.isFinite(Number(value))) {
    return null;
  }

  return Number(value);
}

function getClassScorePercent(item) {
  const value =
    item.score_percent ??
    (item.score != null ? Number(item.score) * 100 : null);

  return value != null && Number.isFinite(Number(value))
    ? Number(value)
    : null;
}

function App() {
  const [token, setToken] = useState(
    () => sessionStorage.getItem("medguardian_token") || ""
  );
  const [user, setUser] = useState(null);
  const [modules, setModules] = useState([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [staffUsername, setStaffUsername] = useState("");
  const [staffPassword, setStaffPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [apiStatus, setApiStatus] = useState("Checking");

  const [activeModule, setActiveModule] = useState("");
  // Analysis history state
const [historyRecords, setHistoryRecords] = useState([]);
const [historySummary, setHistorySummary] = useState({});
const [historyFilter, setHistoryFilter] = useState("all");
const [historyLoading, setHistoryLoading] = useState(false);
const [historyError, setHistoryError] = useState("");

  // Skin analysis state
  const [skinImage, setSkinImage] = useState(null);
  const [skinPreview, setSkinPreview] = useState("");
  const [skinResult, setSkinResult] = useState(null);
  const [skinLoading, setSkinLoading] = useState(false);

  // Brain MRI analysis state
  const [brainImage, setBrainImage] = useState(null);
  const [brainPreview, setBrainPreview] = useState("");
  const [brainResult, setBrainResult] = useState(null);
  const [brainLoading, setBrainLoading] = useState(false);

  // Diabetic retinopathy analysis state
  const [retinaImage, setRetinaImage] = useState(null);
  const [retinaPreview, setRetinaPreview] = useState("");
  const [retinaResult, setRetinaResult] = useState(null);
  const [retinaLoading, setRetinaLoading] = useState(false);

  // Lung image analysis state
  const [lungImage, setLungImage] = useState(null);
  const [lungPreview, setLungPreview] = useState("");
  const [lungResult, setLungResult] = useState(null);
  const [lungLoading, setLungLoading] = useState(false);

  // Fictional demo details for the report
  const [patientDetails, setPatientDetails] = useState({
    patientName: "Demo Patient",
    dateOfBirth: "1995-01-15",
    contactDetails: "00000 00000",
    medicalRecordNumber: "MG-DEMO-0001",
    caseNumber: "MG-2026-0001",
    examinationDate: new Date().toLocaleDateString("en-CA"),
  });

  const skinDiseaseInfo = getSkinDiseaseInfo(skinResult);

  const reportResult =
    activeModule === "skin"
      ? skinResult
      : activeModule === "brain"
        ? brainResult
        : activeModule === "retina"
          ? retinaResult
          : activeModule === "lung"
            ? lungResult
            : null;

  const reportModuleName =
    activeModule === "skin"
      ? "Skin Image Analysis"
      : activeModule === "brain"
        ? "Brain MRI Analysis"
        : activeModule === "retina"
          ? "Diabetic Retinopathy Analysis"
          : activeModule === "lung"
            ? "Lung Image Analysis"
            : "Medical Image Analysis";

  const reportPrediction = reportResult
    ? reportResult.disease_name ||
      reportResult.predicted_class ||
      "Not available"
    : "";

  const reportRecommendations = getReportRecommendations(
    activeModule,
    reportPrediction,
    skinDiseaseInfo
  );

  const reportScore = getScorePercent(reportResult);

  const reportGradcam = imageDataUrl(
    reportResult?.gradcam_overlay || ""
  );

  async function request(path, options = {}, accessToken = token) {
    const headers = { ...(options.headers || {}) };

    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    const response = await fetch(`${API}${path}`, {
      ...options,
      headers,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const detail = data.detail;

      throw new Error(
        typeof detail === "string"
          ? detail
          : detail
            ? JSON.stringify(detail)
            : `Request failed (${response.status})`
      );
    }

    return data;
  }

  async function loadDashboard(accessToken) {
    const profile = await request(
      "/api/auth/me",
      {},
      accessToken
    );

    const moduleData = await request(
      "/api/modules",
      {},
      accessToken
    );

    setUser(profile);
    setModules(moduleData.modules || []);
    setActiveModule("dashboard");
    setToken(accessToken);
    sessionStorage.setItem("medguardian_token", accessToken);
  }

  async function loadHistory(
  accessToken = token,
  selectedModule = historyFilter
) {
  if (!accessToken) return;

  setHistoryLoading(true);
  setHistoryError("");

  try {
    const params = new URLSearchParams({ limit: "100" });

    if (selectedModule !== "all") {
      params.set("module", selectedModule);
    }

    const [historyData, summaryData] = await Promise.all([
      request(`/api/history?${params.toString()}`, {}, accessToken),
      request("/api/history/summary", {}, accessToken),
    ]);

    const records = Array.isArray(historyData)
      ? historyData
      : historyData.records ||
        historyData.items ||
        historyData.history ||
        [];

    setHistoryRecords(records);

    const summary = Array.isArray(summaryData)
      ? summaryData
      : summaryData.summary ||
        summaryData.counts ||
        summaryData;

    const normalized = {};

    if (Array.isArray(summary)) {
      summary.forEach((item) => {
        if (item.module) {
          normalized[item.module] = Number(
            item.count ??
              item.total ??
              item.analysis_count ??
              0
          );
        }
      });
    } else if (summary && typeof summary === "object") {
      ["skin", "brain", "retina", "lung"].forEach(
        (moduleName) => {
          if (summary[moduleName] !== undefined) {
            const value = summary[moduleName];

            normalized[moduleName] = Number(
              typeof value === "object"
                ? value.count ?? value.total ?? 0
                : value
            );
          }
        }
      );
    }

    setHistorySummary(normalized);
  } catch (err) {
    setHistoryRecords([]);
    setHistoryError(
      err.message || "Unable to load analysis history."
    );
  } finally {
    setHistoryLoading(false);
  }
}

function openHistory() {
  setActiveModule("history");
  setError("");
  setMessage("");
  loadHistory(token, historyFilter);
}

function handleHistoryFilterChange(event) {
  const selectedModule = event.target.value;
  setHistoryFilter(selectedModule);
  loadHistory(token, selectedModule);
}

function formatHistoryDate(value) {
  if (!value) return "Date not available";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleString();
}

function formatHistoryScore(value) {
  if (value == null || !Number.isFinite(Number(value))) {
    return "Not available";
  }

  const score = Number(value);

  return `${(score <= 1 ? score * 100 : score).toFixed(2)}%`;
}

  useEffect(() => {
    let cancelled = false;

    fetch(`${API}/api/health`)
      .then((response) => {
        if (!response.ok) throw new Error("API unavailable");
        return response.json();
      })
      .then(() => {
        if (!cancelled) setApiStatus("Connected");
      })
      .catch(() => {
        if (!cancelled) setApiStatus("Unavailable");
      });

    const savedToken = sessionStorage.getItem("medguardian_token");

        if (savedToken) {
      Promise.resolve()
        .then(() => {
          if (cancelled) return;
          return loadDashboard(savedToken);
        })
        .catch(() => {
          sessionStorage.removeItem("medguardian_token");

          if (!cancelled) {
            setToken("");
            setUser(null);
            setModules([]);
          }
        });
    }

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleLogin(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const form = new URLSearchParams();
      form.set("username", username.trim());
      form.set("password", password);

      const data = await request(
        "/api/auth/login",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: form.toString(),
        },
        ""
      );

      await loadDashboard(data.access_token);
      setPassword("");
      setMessage("Login successful.");
    } catch (err) {
      setError(err.message || "Unable to log in.");
    } finally {
      setLoading(false);
    }
  }

  function clearImageSelection(setImage, setPreview, setResult, setBusy) {
    setImage(null);

    setPreview((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return "";
    });

    setResult(null);
    setBusy(false);
  }

  function clearSkinSelection() {
    clearImageSelection(
      setSkinImage,
      setSkinPreview,
      setSkinResult,
      setSkinLoading
    );
  }

  function clearBrainSelection() {
    clearImageSelection(
      setBrainImage,
      setBrainPreview,
      setBrainResult,
      setBrainLoading
    );
  }

  function clearRetinaSelection() {
    clearImageSelection(
      setRetinaImage,
      setRetinaPreview,
      setRetinaResult,
      setRetinaLoading
    );
  }

  function clearLungSelection() {
    clearImageSelection(
      setLungImage,
      setLungPreview,
      setLungResult,
      setLungLoading
    );
  }

  function handleLogout() {
    sessionStorage.removeItem("medguardian_token");
    setToken("");
    setUser(null);
    setModules([]);
    setUsername("");
    setPassword("");
    setStaffUsername("");
    setStaffPassword("");
    setMessage("");
    setError("");
    setActiveModule("");
    clearSkinSelection();
    clearBrainSelection();
    clearRetinaSelection();
    clearLungSelection();
    setHistoryRecords([]);
setHistorySummary({});
setHistoryFilter("all");
setHistoryError("");
setHistoryLoading(false);
  }

  async function handleCreateStaff(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const data = await request("/api/admin/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: staffUsername.trim(),
          password: staffPassword,
        }),
      });

      setMessage(
        `Staff account '${data.username}' created successfully.`
      );
      setStaffUsername("");
      setStaffPassword("");
    } catch (err) {
      setError(err.message || "Unable to create staff account.");
    } finally {
      setLoading(false);
    }
  }

  function handlePatientDetailChange(event) {
    const { name, value } = event.target;

    setPatientDetails((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  function printMedicalReport() {
    window.print();
  }

  function createImageChangeHandler({
    setImage,
    setPreview,
    setResult,
    moduleLabel,
  }) {
    return function handleImageChange(event) {
      const file = event.target.files?.[0];

      setError("");
      setMessage("");
      setResult(null);

      if (!file) {
        setImage(null);
        setPreview((previous) => {
          if (previous) URL.revokeObjectURL(previous);
          return "";
        });
        return;
      }

      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        setImage(null);
        setPreview((previous) => {
          if (previous) URL.revokeObjectURL(previous);
          return "";
        });
        setError(
          `Please select a JPEG, PNG, or WebP ${moduleLabel} image.`
        );
        event.target.value = "";
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        setImage(null);
        setPreview((previous) => {
          if (previous) URL.revokeObjectURL(previous);
          return "";
        });
        setError("Image size must not exceed 10 MB.");
        event.target.value = "";
        return;
      }

      setImage(file);
      setPreview((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return URL.createObjectURL(file);
      });
    };
  }

  const handleSkinImageChange = createImageChangeHandler({
    setImage: setSkinImage,
    setPreview: setSkinPreview,
    setResult: setSkinResult,
    moduleLabel: "skin",
  });

  const handleBrainImageChange = createImageChangeHandler({
    setImage: setBrainImage,
    setPreview: setBrainPreview,
    setResult: setBrainResult,
    moduleLabel: "brain MRI",
  });

  const handleRetinaImageChange = createImageChangeHandler({
    setImage: setRetinaImage,
    setPreview: setRetinaPreview,
    setResult: setRetinaResult,
    moduleLabel: "retinal",
  });

  const handleLungImageChange = createImageChangeHandler({
    setImage: setLungImage,
    setPreview: setLungPreview,
    setResult: setLungResult,
    moduleLabel: "lung",
  });

  async function analyzeImage({
    event,
    image,
    setResult,
    setBusy,
    endpoint,
    label,
  }) {
    event.preventDefault();

    if (!image) {
      setError(`Please select an image before starting ${label}.`);
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("image", image);

      const result = await request(endpoint, {
        method: "POST",
        body: formData,
      });

      setResult(result);
    } catch (err) {
      setError(err.message || `${label} failed.`);
    } finally {
      setBusy(false);
    }
  }

  function handleSkinExplain(event) {
    return analyzeImage({
      event,
      image: skinImage,
      setResult: setSkinResult,
      setBusy: setSkinLoading,
      endpoint: "/api/skin/explain",
      label: "skin image analysis",
    });
  }

  function handleBrainExplain(event) {
    return analyzeImage({
      event,
      image: brainImage,
      setResult: setBrainResult,
      setBusy: setBrainLoading,
      endpoint: "/api/brain/explain",
      label: "brain MRI analysis",
    });
  }

  function handleRetinaExplain(event) {
    return analyzeImage({
      event,
      image: retinaImage,
      setResult: setRetinaResult,
      setBusy: setRetinaLoading,
      endpoint: "/api/retinopathy/explain",
      label: "diabetic retinopathy analysis",
    });
  }

  function handleLungExplain(event) {
    return analyzeImage({
      event,
      image: lungImage,
      setResult: setLungResult,
      setBusy: setLungLoading,
      endpoint: "/api/lung/explain",
      label: "lung image analysis",
    });
  }

  function openSkinModule() {
    setActiveModule("skin");
    setError("");
    setMessage("");
    setSkinResult(null);
  }

  function closeSkinModule() {
    setActiveModule("");
    setError("");
    setMessage("");
    clearSkinSelection();
  }

  function openBrainModule() {
    setActiveModule("brain");
    setError("");
    setMessage("");
    setBrainResult(null);
  }

  function closeBrainModule() {
    setActiveModule("");
    setError("");
    setMessage("");
    clearBrainSelection();
  }

  function openRetinaModule() {
    setActiveModule("retina");
    setError("");
    setMessage("");
    setRetinaResult(null);
  }

  function closeRetinaModule() {
    setActiveModule("");
    setError("");
    setMessage("");
    clearRetinaSelection();
  }

  function openLungModule() {
    setActiveModule("lung");
    setError("");
    setMessage("");
    setLungResult(null);
  }

  function closeLungModule() {
    setActiveModule("");
    setError("");
    setMessage("");
    clearLungSelection();
  }

  function renderModelSummary(result, moduleLabel) {
    if (!result) return null;

    return (
      <div className="result-summary">
        <p className="eyebrow">MODEL OUTPUT</p>
        <h4>
          {result.disease_name ||
            result.predicted_class ||
            "Result unavailable"}
        </h4>
        <p>
          Predicted class:{" "}
          <strong>{result.predicted_class || "Not available"}</strong>
        </p>
        <p>
          Model score:{" "}
          <strong>
            {getScorePercent(result) != null
              ? `${getScorePercent(result).toFixed(2)}%`
              : "Not available"}
          </strong>
        </p>
        {Array.isArray(result.class_scores) && (
          <div className="class-scores">
            <h4>Scores for {moduleLabel} classes</h4>
            {result.class_scores.map((item, index) => {
              const score = getClassScorePercent(item);
              return (
                <div
                  className="class-score-row"
                  key={`${item.class || item.disease_name || "class"}-${index}`}
                >
                  <span>{item.disease_name || item.class || "Unknown"}</span>
                  <strong>
                    {score != null ? `${score.toFixed(2)}%` : "N/A"}
                  </strong>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  if (!user) {
    return (
      <main className="app-shell login-shell">
        <header className="topbar">
          <div className="brand">
            <div className="brand-mark">M</div>
            <div>
              <h1>MedGuardian AI</h1>
              <p>Medical imaging research platform</p>
            </div>
          </div>
          <span className={`api-pill ${apiStatus === "Connected" ? "online" : ""}`}>
            <span className="status-dot" /> API {apiStatus}
          </span>
        </header>

        <section className="login-layout">
          <div className="welcome-panel">
            <p className="eyebrow">HOSPITAL STAFF PORTAL</p>
            <h2>Medical imaging insights, in one workspace.</h2>
            <p className="welcome-copy">
              Sign in with an account created by your MedGuardian AI administrator
              to access the available research modules.
            </p>
            <div className="security-note">
              <span className="security-icon">✓</span>
              <div>
                <strong>Staff access only</strong>
                <p>Accounts are created by an administrator.</p>
              </div>
            </div>
          </div>

          <form className="panel login-card" onSubmit={handleLogin}>
            <p className="eyebrow">WELCOME BACK</p>
            <h2>Sign in</h2>
            <p className="muted">Enter your staff account credentials.</p>
            <label htmlFor="login-username">Username</label>
            <input
              id="login-username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              required
            />
            <label htmlFor="login-password">Password</label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
            {error && <p className="alert error-alert">{error}</p>}
            {message && <p className="alert success-alert">{message}</p>}
            <button className="primary-button" type="submit" disabled={loading}>
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </section>
        <footer className="footer">MedGuardian AI · Authorized staff workspace</footer>
      </main>
    );
  }

  const moduleViews = {
    skin: {
      title: "Skin Image Analysis",
      image: skinImage,
      preview: skinPreview,
      result: skinResult,
      busy: skinLoading,
      onChange: handleSkinImageChange,
      onSubmit: handleSkinExplain,
      onClear: clearSkinSelection,
      close: closeSkinModule,
      label: "skin lesion image",
      accept: "image/jpeg,image/png,image/webp",
    },
    brain: {
      title: "Brain MRI Analysis",
      image: brainImage,
      preview: brainPreview,
      result: brainResult,
      busy: brainLoading,
      onChange: handleBrainImageChange,
      onSubmit: handleBrainExplain,
      onClear: clearBrainSelection,
      close: closeBrainModule,
      label: "brain MRI image",
      accept: "image/jpeg,image/png,image/webp",
    },
    retina: {
      title: "Diabetic Retinopathy Analysis",
      image: retinaImage,
      preview: retinaPreview,
      result: retinaResult,
      busy: retinaLoading,
      onChange: handleRetinaImageChange,
      onSubmit: handleRetinaExplain,
      onClear: clearRetinaSelection,
      close: closeRetinaModule,
      label: "retinal image",
      accept: "image/jpeg,image/png,image/webp",
    },
    lung: {
      title: "Lung Image Analysis",
      image: lungImage,
      preview: lungPreview,
      result: lungResult,
      busy: lungLoading,
      onChange: handleLungImageChange,
      onSubmit: handleLungExplain,
      onClear: clearLungSelection,
      close: closeLungModule,
      label: "lung image",
      accept: "image/jpeg,image/png,image/webp",
    },
  };

  const selectedModuleView = moduleViews[activeModule];

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="brand brand-button" type="button" onClick={() => { setActiveModule("dashboard"); setError(""); setMessage(""); }}>
          <div className="brand-mark">M</div>
          <div>
            <h1>MedGuardian AI</h1>
            <p>Medical imaging research platform</p>
          </div>
        </button>
        <div className="topbar-actions">
          <span className={`api-pill ${apiStatus === "Connected" ? "online" : ""}`}>
            <span className="status-dot" /> API {apiStatus}
          </span>
          <span className="muted">{user.username || user.full_name || "Authorized staff"}</span>
          <button className="secondary-button" type="button" onClick={handleLogout}>Log out</button>
        </div>
      </header>

      <div className="workspace-layout">
        <aside className="workspace-sidebar panel">
          <p className="eyebrow">WORKSPACE</p>
          <button className={activeModule === "dashboard" ? "nav-button active" : "nav-button"} type="button" onClick={() => { setActiveModule("dashboard"); setError(""); setMessage(""); }}>Dashboard</button>
          <button className={activeModule === "history" ? "nav-button active" : "nav-button"} type="button" onClick={openHistory}>Analysis History</button>
          {(user.is_admin || user.role === "admin") && (
            <button className={activeModule === "admin" ? "nav-button active" : "nav-button"} type="button" onClick={() => { setActiveModule("admin"); setError(""); setMessage(""); }}>Staff Accounts</button>
          )}
          <p className="sidebar-note">Access is restricted to authorized hospital staff.</p>
        </aside>

        <section className="workspace-content">
          {error && <p className="alert error-alert">{error}</p>}
          {message && <p className="alert success-alert">{message}</p>}

          {activeModule === "dashboard" && (
            <section className="module-section">
              <div className="section-heading">
                <div><p className="eyebrow">AI MODULES</p><h2>Medical imaging workspace</h2><p className="muted">Choose a module to review an image and its model output.</p></div>
                <span className="module-count">{modules.length} modules</span>
              </div>
              <div className="module-grid">
                {modules.map((module) => (
                  <article className="panel module-card" key={module.id}>
                    <div className={`module-icon ${module.id}`}>{module.id === "skin" ? "S" : module.id === "brain" ? "B" : module.id === "retina" ? "R" : "L"}</div>
                    <div className="module-title-row">
                      <h3>{module.name}</h3>
                      <span className={`status-tag ${module.status === "in_development" ? "development" : ""}`}>
                        {module.status === "in_development" ? "In development" : module.status === "existing_model_pending_integration" ? "Integration pending" : module.status}
                      </span>
                    </div>
                    <p className="muted">{moduleDescriptions[module.id] || "Medical imaging module"}</p>
                    <p className="module-note">{module.id === "skin" ? "Upload a skin image to view the model output and Grad-CAM explanation." : module.id === "brain" ? "Upload a brain MRI to view the model output and class scores." : module.id === "retina" ? "Upload a retinal image to view the diabetic retinopathy prediction." : module.id === "lung" ? "Upload a supported lung image to view the model output." : "This module is not yet available for analysis."}</p>
                    <button className="secondary-button module-button" type="button" disabled={!moduleViews[module.id]} onClick={() => module.id === "skin" ? openSkinModule() : module.id === "brain" ? openBrainModule() : module.id === "retina" ? openRetinaModule() : module.id === "lung" ? openLungModule() : undefined}>
                      {moduleViews[module.id] ? `Open ${module.id} analysis` : "Coming soon"}
                    </button>
                  </article>
                ))}
              </div>
              <p className="disclaimer">Research prototype only. Results are not a substitute for assessment by qualified healthcare professionals.</p>
            </section>
          )}

          {activeModule === "history" && (
            <section className="panel history-panel">
              <div className="section-heading">
                <div><p className="eyebrow">RECORDS</p><h2>Analysis History</h2><p className="muted">Previously saved analyses available to your staff account.</p></div>
                <button className="secondary-button" type="button" onClick={() => loadHistory(token, historyFilter)} disabled={historyLoading}>{historyLoading ? "Refreshing…" : "Refresh history"}</button>
              </div>
              <div className="history-toolbar">
                <label htmlFor="history-filter">Filter by module</label>
                <select id="history-filter" value={historyFilter} onChange={handleHistoryFilterChange}>
                  <option value="all">All modules</option><option value="skin">Skin</option><option value="brain">Brain</option><option value="retina">Retina</option><option value="lung">Lung</option>
                </select>
              </div>
              <div className="history-summary-grid">
                {["skin", "brain", "retina", "lung"].map((name) => (
                  <div className="history-summary-card" key={name}><span>{name[0].toUpperCase() + name.slice(1)}</span><strong>{historySummary[name] ?? 0}</strong><small>analyses</small></div>
                ))}
              </div>
              {historyError && <p className="alert error-alert">{historyError}</p>}
              {historyLoading ? <p className="muted">Loading analysis history…</p> : historyRecords.length === 0 ? <p className="empty-state">No analysis records were found for this filter.</p> : (
                <div className="history-table-wrap"><table className="history-table"><thead><tr><th>Date</th><th>Module</th><th>Prediction</th><th>Score</th><th>Record</th></tr></thead><tbody>
                  {historyRecords.map((record, index) => {
                    const recordModule = record.module || record.module_name || record.analysis_type || "Unknown";
                    const prediction = record.disease_name || record.predicted_class || record.prediction || record.result || "Not available";
                    const score = record.confidence_percent ?? record.model_score ?? record.confidence ?? record.score;
                    return <tr key={record.id || record.analysis_id || `${recordModule}-${record.created_at || record.timestamp || index}`}><td>{formatHistoryDate(record.created_at || record.created_on || record.timestamp || record.analysis_date)}</td><td>{String(recordModule).toUpperCase()}</td><td>{prediction}</td><td>{formatHistoryScore(score)}</td><td>{record.id || record.analysis_id || "—"}</td></tr>;
                  })}
                </tbody></table></div>
              )}
              <p className="disclaimer">History shows records returned by the backend. It does not independently validate a model prediction.</p>
            </section>
          )}

          {selectedModuleView && (
            <section className="panel analysis-panel">
              <div className="section-heading"><div><p className="eyebrow">IMAGE WORKSPACE</p><h2>{selectedModuleView.title}</h2><p className="muted">Select a JPEG, PNG, or WebP image up to 10 MB.</p></div><button className="secondary-button" type="button" onClick={selectedModuleView.close}>Back to dashboard</button></div>
              <form onSubmit={selectedModuleView.onSubmit} className="analysis-form">
                <label htmlFor={`${activeModule}-image`}>Choose {selectedModuleView.label}</label>
                <input id={`${activeModule}-image`} type="file" accept={selectedModuleView.accept} onChange={selectedModuleView.onChange} />
                {selectedModuleView.preview && <div className="image-preview-wrap"><img className="image-preview" src={selectedModuleView.preview} alt={`Selected ${selectedModuleView.label} preview`} /></div>}
                <div className="button-row"><button className="primary-button" type="submit" disabled={selectedModuleView.busy || !selectedModuleView.image}>{selectedModuleView.busy ? "Analyzing…" : "Analyze image"}</button><button className="secondary-button" type="button" onClick={selectedModuleView.onClear} disabled={selectedModuleView.busy}>Clear image</button></div>
              </form>
              {selectedModuleView.result && <>
                {renderModelSummary(selectedModuleView.result, selectedModuleView.title)}
                {selectedModuleView.result.gradcam_overlay && <div className="explanation-panel"><h3>Model explanation (Grad-CAM)</h3><img className="image-preview" src={imageDataUrl(selectedModuleView.result.gradcam_overlay)} alt="Grad-CAM model explanation overlay" /></div>}
                {activeModule === "skin" && skinDiseaseInfo && <div className="disease-info"><h3>{skinDiseaseInfo.title}</h3><p>{skinDiseaseInfo.overview}</p><p><strong>Common signs:</strong> {skinDiseaseInfo.signs}</p><p><strong>Suggested next steps:</strong> {skinDiseaseInfo.nextSteps}</p></div>}
                <div className="report-actions"><button className="secondary-button" type="button" onClick={() => { setMessage("Report view is prepared below."); document.getElementById("medical-report")?.scrollIntoView({ behavior: "smooth" }); }}>View report details</button></div>
                      {/* Patient report editor and printable report */}
      {reportResult && (
        <section className="panel report-workspace">
          <div className="report-editor">
            <p className="eyebrow">MEDICAL REPORT</p>
            <h3>Patient and case details</h3>
            <p className="muted">
              These fictional demo details can be edited before printing.
            </p>

            <div className="report-form-grid">
              <div className="field">
                <label htmlFor="report-patient-name">Patient name</label>
                <input
                  id="report-patient-name"
                  name="patientName"
                  value={patientDetails.patientName}
                  onChange={handlePatientDetailChange}
                  required
                />
              </div>

              <div className="field">
                <label htmlFor="report-dob">Date of birth</label>
                <input
                  id="report-dob"
                  name="dateOfBirth"
                  type="date"
                  value={patientDetails.dateOfBirth}
                  onChange={handlePatientDetailChange}
                  required
                />
              </div>

              <div className="field">
                <label htmlFor="report-contact">Contact details</label>
                <input
                  id="report-contact"
                  name="contactDetails"
                  value={patientDetails.contactDetails}
                  onChange={handlePatientDetailChange}
                  required
                />
              </div>

              <div className="field">
                <label htmlFor="report-mrn">Medical record number</label>
                <input
                  id="report-mrn"
                  name="medicalRecordNumber"
                  value={patientDetails.medicalRecordNumber}
                  onChange={handlePatientDetailChange}
                  required
                />
              </div>

              <div className="field">
                <label htmlFor="report-case">Case number</label>
                <input
                  id="report-case"
                  name="caseNumber"
                  value={patientDetails.caseNumber}
                  onChange={handlePatientDetailChange}
                  required
                />
              </div>

              <div className="field">
                <label htmlFor="report-exam-date">Examination date</label>
                <input
                  id="report-exam-date"
                  name="examinationDate"
                  type="date"
                  value={patientDetails.examinationDate}
                  onChange={handlePatientDetailChange}
                  required
                />
              </div>
            </div>

            <button
              className="primary-button"
              type="button"
              onClick={printMedicalReport}
            >
              Print / Save as PDF
            </button>
          </div>

          <article className="print-report">
            <header className="report-header">
              <div className="report-brand">
                <div className="brand-mark">M</div>
                <div>
                  <h1>MedGuardian AI</h1>
                  <p>Medical Imaging Analysis Report</p>
                </div>
              </div>

              <div className="report-demo-stamp">
                DEMO DATA â€” NOT FOR CLINICAL USE
              </div>
            </header>

            <h2 className="report-title">MEDICAL ANALYSIS REPORT</h2>

            <div className="report-patient-grid">
              <section className="report-info-box">
                <h3>PATIENT INFORMATION</h3>
                <p>
                  <strong>Patient name:</strong>{" "}
                  {patientDetails.patientName || "Not provided"}
                </p>
                <p>
                  <strong>Date of birth:</strong>{" "}
                  {patientDetails.dateOfBirth || "Not provided"}
                </p>
                <p>
                  <strong>Contact:</strong>{" "}
                  {patientDetails.contactDetails || "Not provided"}
                </p>
                <p>
                  <strong>Medical record no.:</strong>{" "}
                  {patientDetails.medicalRecordNumber || "Not provided"}
                </p>
              </section>

              <section className="report-info-box">
                <h3>CASE INFORMATION</h3>
                <p>
                  <strong>Case number:</strong>{" "}
                  {patientDetails.caseNumber || "Not provided"}
                </p>
                <p>
                  <strong>Examination date:</strong>{" "}
                  {patientDetails.examinationDate || "Not provided"}
                </p>
                <p>
                  <strong>Analysis module:</strong> {reportModuleName}
                </p>
                <p>
                  <strong>Report generated:</strong>{" "}
                  {new Date().toLocaleDateString()}
                </p>
              </section>
            </div>

            <section className="report-section">
              <h3>AI-ASSISTED FINDINGS</h3>
              <p>
                <strong>Model prediction:</strong>{" "}
                {reportPrediction || "Not available"}
              </p>
              <p>
                <strong>Model score:</strong>{" "}
                {reportScore != null
                  ? `${reportScore.toFixed(2)}%`
                  : "Not available"}
              </p>
              <p>
                <strong>Examination type:</strong> {reportModuleName}
              </p>
            </section>

            {/* Newly integrated recommendation section */}
            <section className="report-section">
              <h3>{reportRecommendations.title.toUpperCase()}</h3>

              <ul>
                {reportRecommendations.items.map((item, index) => (
                  <li key={`${activeModule}-recommendation-${index}`}>
                    {item}
                  </li>
                ))}
              </ul>

              <p>
                <strong>Clinical urgency:</strong>{" "}
                {reportRecommendations.urgency}
              </p>
            </section>

            {activeModule === "skin" && skinDiseaseInfo && (
              <section className="report-section">
                <h3>EDUCATIONAL DISEASE INFORMATION</h3>
                <p>
                  <strong>{skinDiseaseInfo.title}</strong>
                </p>
                <p>{skinDiseaseInfo.overview}</p>
                <p>
                  <strong>Possible signs:</strong> {skinDiseaseInfo.signs}
                </p>
                <p>
                  <strong>Suggested follow-up:</strong>{" "}
                  {skinDiseaseInfo.nextSteps}
                </p>
              </section>
            )}

            {reportGradcam && (
              <section className="report-section report-xai">
                <h3>GRAD-CAM EXPLAINABILITY VISUALIZATION</h3>
                <p>
                  Highlighted regions represent image features associated with
                  the model prediction. They do not independently confirm a
                  disease or define a tumor boundary.
                </p>
                <img
                  src={reportGradcam}
                  alt="Grad-CAM explanation visualization"
                />
              </section>
            )}

            {Array.isArray(reportResult.class_scores) &&
              reportResult.class_scores.length > 0 && (
                <section className="report-section">
                  <h3>MODEL SCORES BY CLASS</h3>
                  <table className="report-scores-table">
                    <thead>
                      <tr>
                        <th>Class</th>
                        <th>Model score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportResult.class_scores.map((item, index) => {
                        const score = getClassScorePercent(item);

                        return (
                          <tr
                            key={`${item.class || item.disease_name || "class"}-${index}`}
                          >
                            <td>
                              {item.disease_name || item.class || "Unknown"}
                            </td>
                            <td>
                              {score != null
                                ? `${score.toFixed(2)}%`
                                : "Not available"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </section>
              )}

            <section className="report-section">
              <h3>INTERPRETATION AND LIMITATIONS</h3>
              <p>
                This report records an AI model output for research and
                demonstration purposes. A model score is not a calibrated
                clinical probability and does not establish a diagnosis.
              </p>
              <p>
                Grad-CAM is an explanatory visualization, not a tumor
                segmentation or measurement tool. The result must be reviewed
                by an appropriately qualified healthcare professional alongside
                the original images and relevant clinical information.
              </p>
            </section>

            <footer className="report-footer">
              <strong>MedGuardian AI Â· Research prototype</strong>
              <span>DEMO REPORT â€” NOT A CLINICAL DIAGNOSIS</span>
            </footer>
          </article>
        </section>
      )}
              </>}
            </section>
          )}

          {activeModule === "admin" && (user.is_admin || user.role === "admin") && (
            <section className="panel admin-panel">
              <p className="eyebrow">ADMINISTRATION</p><h2>Create staff account</h2><p className="muted">Create an account for authorized hospital staff.</p>
              <form onSubmit={handleCreateStaff} className="staff-form">
                <label htmlFor="staff-username">Staff username</label><input id="staff-username" value={staffUsername} onChange={(event) => setStaffUsername(event.target.value)} autoComplete="off" required />
                <label htmlFor="staff-password">Temporary password</label><input id="staff-password" type="password" value={staffPassword} onChange={(event) => setStaffPassword(event.target.value)} autoComplete="new-password" minLength={12} required />
                <button className="primary-button" type="submit" disabled={loading}>{loading ? "Creating…" : "Create staff account"}</button>
              </form>
            </section>
          )}

          <footer className="footer">MedGuardian AI · Authorized staff workspace</footer>
        </section>
      </div>
    </main>
  );
}
export default App;
