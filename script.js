/* ---------- Elements ---------- */
const taskForm = document.getElementById("task-form");
const taskInput = document.getElementById("task-input");
const taskPriority = document.getElementById("task-priority");
const taskDue = document.getElementById("task-due");
const taskList = document.getElementById("task-list");

const totalCount = document.getElementById("total-count");
const completedCount = document.getElementById("completed-count");
const emptyMessage = document.getElementById("empty-message");
const clearCompletedButton = document.getElementById("clear-completed");
const filterButtons = document.querySelectorAll(".filter");
const progressBar = document.getElementById("progress");
const progressFill = document.getElementById("progress-fill");
const progressText = document.getElementById("progress-text");

const examForm = document.getElementById("exam-form");
const examCourse = document.getElementById("exam-course");
const examType = document.getElementById("exam-type");
const examDate = document.getElementById("exam-date");
const examTime = document.getElementById("exam-time");
const examNote = document.getElementById("exam-note");
const examList = document.getElementById("exam-list");
const examEmptyMessage = document.getElementById("exam-empty-message");
const clearPastExamsButton = document.getElementById("clear-past-exams");
const examFilterButtons = document.querySelectorAll(".exam-filter");
const nextExamBox = document.getElementById("next-exam");

const tabButtons = document.querySelectorAll(".tab");
const tasksPanel = document.getElementById("tasks-panel");
const examsPanel = document.getElementById("exams-panel");
const themeToggle = document.getElementById("theme-toggle");
const marksPanel = document.getElementById("marks-panel");

/* ---------- Constants and storage ---------- */
const STORAGE = {
    tasks: "studentTasks",
    exams: "studentExams",
    theme: "studentTheme",
    marks: "studentMarks"
};

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };
const PRIORITY_LABEL = { high: "High", medium: "Medium", low: "Low" };
const EXAM_LABEL = { ct1: "CT-1", ct2: "CT-2", ct3: "CT-3", mid: "Mid", final: "Final" };

function loadList(key, isValid) {
    try {
        const data = JSON.parse(localStorage.getItem(key) || "[]");
        return Array.isArray(data) ? data.filter(isValid) : [];
    } catch {
        return [];
    }
}

function saveList(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch {
        /* storage full or blocked: the app still works for this session */
    }
}

/* Old tasks (without priority/due) still load fine. */
let tasks = loadList(STORAGE.tasks, task =>
    task &&
    typeof task.id === "string" &&
    typeof task.text === "string" &&
    typeof task.completed === "boolean"
).map(task => ({
    id: task.id,
    text: task.text,
    completed: task.completed,
    priority: PRIORITY_ORDER[task.priority] !== undefined ? task.priority : "medium",
    due: typeof task.due === "string" ? task.due : ""
}));

let exams = loadList(STORAGE.exams, exam =>
    exam &&
    typeof exam.id === "string" &&
    typeof exam.course === "string" &&
    (EXAM_LABEL[exam.type] !== undefined || exam.type === "ct") &&
    typeof exam.date === "string" &&
    typeof exam.time === "string"
).map(exam => ({
    id: exam.id,
    course: exam.course,
    type: exam.type === "ct" ? "ct1" : exam.type,
    date: exam.date,
    time: exam.time,
    note: typeof exam.note === "string" ? exam.note : ""
}));

let currentFilter = "all";
let currentExamFilter = "all";

/* ---------- Date helpers ---------- */
function toDateString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function daysFromToday(dateString) {
    const target = new Date(`${dateString}T00:00`);
    const today = new Date(`${toDateString(new Date())}T00:00`);
    return Math.round((target - today) / 86400000);
}

function examDateTime(exam) {
    return new Date(`${exam.date}T${exam.time}`);
}

function formatExamWhen(exam) {
    const when = examDateTime(exam);
    const day = when.toLocaleDateString(undefined, {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric"
    });
    const time = when.toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit"
    });
    return `${day}, ${time}`;
}

function getCountdown(exam) {
    const diff = examDateTime(exam) - new Date();

    if (diff < 0) {
        return { text: "Finished", cls: "past", finished: true };
    }

    const minutes = Math.floor(diff / 60000);
    const days = Math.floor(minutes / 1440);
    const hours = Math.floor((minutes % 1440) / 60);
    const mins = minutes % 60;

    let left;
    if (days > 0) {
        left = `${days}d ${hours}h left`;
    } else if (hours > 0) {
        left = `${hours}h ${mins}m left`;
    } else {
        left = `${mins}m left`;
    }

    const dayGap = daysFromToday(exam.date);
    let text = left;
    if (dayGap === 0) {
        text = `Today, ${left}`;
    } else if (dayGap === 1) {
        text = `Tomorrow, ${left}`;
    }

    const cls = dayGap <= 1 ? "urgent" : dayGap <= 3 ? "soon" : "later";
    return { text, cls, finished: false };
}

function sortedExams() {
    return [...exams].sort((a, b) => examDateTime(a) - examDateTime(b));
}

/* ---------- Tasks ---------- */
function saveTasks() {
    saveList(STORAGE.tasks, tasks);
}

function dueInfo(task) {
    if (!task.due) {
        return null;
    }

    const pretty = new Date(`${task.due}T00:00`).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short"
    });

    if (task.completed) {
        return { text: `Due ${pretty}`, cls: "" };
    }

    const gap = daysFromToday(task.due);

    if (gap < 0) {
        return { text: `Overdue since ${pretty}`, cls: "overdue" };
    }
    if (gap === 0) {
        return { text: "Due today", cls: "today" };
    }
    if (gap === 1) {
        return { text: "Due tomorrow", cls: "today" };
    }
    return { text: `Due ${pretty}`, cls: "" };
}

function makeChip(text, cls) {
    const chip = document.createElement("span");
    chip.className = cls ? `chip ${cls}` : "chip";
    chip.textContent = text;
    return chip;
}

function compareTasks(a, b) {
    if (a.completed !== b.completed) {
        return a.completed ? 1 : -1;
    }
    if (PRIORITY_ORDER[a.priority] !== PRIORITY_ORDER[b.priority]) {
        return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    }
    if (a.due && b.due) {
        return a.due.localeCompare(b.due);
    }
    if (a.due) {
        return -1;
    }
    if (b.due) {
        return 1;
    }
    return 0;
}

function renderTasks() {
    taskList.replaceChildren();

    const visibleTasks = tasks
        .filter(task => {
            if (currentFilter === "pending") {
                return !task.completed;
            }
            if (currentFilter === "completed") {
                return task.completed;
            }
            return true;
        })
        .sort(compareTasks);

    visibleTasks.forEach(task => {
        const item = document.createElement("li");
        item.className = "task-item";

        if (task.completed) {
            item.classList.add("done");
        }

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = task.completed;
        checkbox.setAttribute("aria-label", "Mark task completed");

        checkbox.addEventListener("change", () => {
            task.completed = checkbox.checked;
            saveTasks();
            renderTasks();
        });

        const body = document.createElement("div");
        body.className = "task-body";

        const text = document.createElement("span");
        text.className = "task-text";
        text.textContent = task.text;

        const chips = document.createElement("div");
        chips.className = "chips";
        chips.appendChild(makeChip(PRIORITY_LABEL[task.priority], task.priority));

        const due = dueInfo(task);
        if (due) {
            chips.appendChild(makeChip(due.text, due.cls));
        }

        body.append(text, chips);

        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "delete-button";
        deleteButton.textContent = "Delete";
        deleteButton.setAttribute("aria-label", "Delete " + task.text);

        deleteButton.addEventListener("click", () => {
            tasks = tasks.filter(other => other.id !== task.id);
            saveTasks();
            renderTasks();
        });

        item.append(checkbox, body, deleteButton);
        taskList.appendChild(item);
    });

    const completed = tasks.filter(task => task.completed).length;
    const percent = tasks.length ? Math.round((completed / tasks.length) * 100) : 0;

    totalCount.textContent = `Total: ${tasks.length}`;
    completedCount.textContent = `Completed: ${completed}`;
    progressFill.style.width = `${percent}%`;
    progressBar.setAttribute("aria-valuenow", String(percent));
    progressText.textContent = `${percent}% done`;

    emptyMessage.hidden = visibleTasks.length > 0;
    clearCompletedButton.disabled = completed === 0;
}

taskForm.addEventListener("submit", event => {
    event.preventDefault();

    const text = taskInput.value.trim();

    if (!text) {
        return;
    }

    tasks.push({
        id: crypto.randomUUID(),
        text: text,
        completed: false,
        priority: taskPriority.value,
        due: taskDue.value
    });

    saveTasks();
    taskInput.value = "";
    taskDue.value = "";
    taskPriority.value = "medium";
    currentFilter = "all";

    updateFilterButtons();
    renderTasks();
    taskInput.focus();
});

function updateFilterButtons() {
    filterButtons.forEach(button => {
        const isActive = button.dataset.filter === currentFilter;

        button.classList.toggle("active", isActive);
        button.setAttribute("aria-pressed", String(isActive));
    });
}

filterButtons.forEach(button => {
    button.addEventListener("click", () => {
        currentFilter = button.dataset.filter;
        updateFilterButtons();
        renderTasks();
    });
});

clearCompletedButton.addEventListener("click", () => {
    tasks = tasks.filter(task => !task.completed);
    saveTasks();
    renderTasks();
});

/* ---------- Exams ---------- */
function saveExams() {
    saveList(STORAGE.exams, exams);
}

function renderNextExam() {
    nextExamBox.replaceChildren();
    nextExamBox.classList.remove("empty");

    const next = sortedExams().find(exam => !getCountdown(exam).finished);

    if (!next) {
        nextExamBox.classList.add("empty");
        nextExamBox.textContent = "No upcoming exams. Add one in the Exams tab.";
        return;
    }

    const info = document.createElement("div");

    const title = document.createElement("div");
    title.className = "next-title";
    title.textContent = `Next: ${EXAM_LABEL[next.type]} - ${next.course}`;

    const when = document.createElement("div");
    when.className = "next-when";
    when.textContent = formatExamWhen(next);

    info.append(title, when);

    const countdown = getCountdown(next);
    const badge = document.createElement("span");
    badge.className = `countdown ${countdown.cls}`;
    badge.textContent = countdown.text;

    nextExamBox.append(info, badge);
}

function renderExams() {
    examList.replaceChildren();

    const visibleExams = sortedExams().filter(exam =>
        currentExamFilter === "all" || exam.type === currentExamFilter
    );

    /* Upcoming first (soonest on top), finished exams at the bottom. */
    const upcoming = visibleExams.filter(exam => !getCountdown(exam).finished);
    const finished = visibleExams.filter(exam => getCountdown(exam).finished).reverse();

    [...upcoming, ...finished].forEach(exam => {
        const countdown = getCountdown(exam);

        const item = document.createElement("li");
        item.className = "exam-item";

        if (countdown.finished) {
            item.classList.add("past");
        }

        const badge = document.createElement("span");
        badge.className = `exam-badge ${exam.type}`;
        badge.textContent = EXAM_LABEL[exam.type];

        const body = document.createElement("div");
        body.className = "exam-body";

        const course = document.createElement("div");
        course.className = "exam-course";
        course.textContent = exam.course;

        const meta = document.createElement("div");
        meta.className = "exam-meta";
        meta.textContent = exam.note
            ? `${formatExamWhen(exam)} | ${exam.note}`
            : formatExamWhen(exam);

        body.append(course, meta);

        const countdownBadge = document.createElement("span");
        countdownBadge.className = `countdown ${countdown.cls}`;
        countdownBadge.textContent = countdown.text;

        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "delete-button";
        deleteButton.textContent = "Delete";
        deleteButton.setAttribute("aria-label", "Delete exam " + exam.course);

        deleteButton.addEventListener("click", () => {
            exams = exams.filter(other => other.id !== exam.id);
            saveExams();
            renderExams();
            renderNextExam();
        });

        item.append(badge, body, countdownBadge, deleteButton);
        examList.appendChild(item);
    });

    examEmptyMessage.hidden = visibleExams.length > 0;
    clearPastExamsButton.disabled = !exams.some(exam => getCountdown(exam).finished);
}

examForm.addEventListener("submit", event => {
    event.preventDefault();

    const course = examCourse.value.trim();

    if (!course || !examDate.value || !examTime.value) {
        return;
    }

    exams.push({
        id: crypto.randomUUID(),
        course: course,
        type: examType.value,
        date: examDate.value,
        time: examTime.value,
        note: examNote.value.trim()
    });

    saveExams();
    examCourse.value = "";
    examNote.value = "";
    examDate.value = "";
    examTime.value = "";
    currentExamFilter = "all";

    updateExamFilterButtons();
    renderExams();
    renderNextExam();
    examCourse.focus();
});

function updateExamFilterButtons() {
    examFilterButtons.forEach(button => {
        const isActive = button.dataset.examFilter === currentExamFilter;

        button.classList.toggle("active", isActive);
        button.setAttribute("aria-pressed", String(isActive));
    });
}

examFilterButtons.forEach(button => {
    button.addEventListener("click", () => {
        currentExamFilter = button.dataset.examFilter;
        updateExamFilterButtons();
        renderExams();
    });
});

clearPastExamsButton.addEventListener("click", () => {
    exams = exams.filter(exam => !getCountdown(exam).finished);
    saveExams();
    renderExams();
    renderNextExam();
});

/* ---------- Tabs ---------- */
function showTab(name) {
    const showTasks = name === "tasks";

    tasksPanel.hidden = !showTasks;
    examsPanel.hidden = name !== "exams";
    marksPanel.hidden = name !== "marks";

    tabButtons.forEach(button => {
        const isActive = button.dataset.tab === name;

        button.classList.toggle("active", isActive);
        button.setAttribute("aria-pressed", String(isActive));
    });
}

tabButtons.forEach(button => {
    button.addEventListener("click", () => showTab(button.dataset.tab));
});

/* ---------- Dark mode ---------- */
function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    const isDark = theme === "dark";

    themeToggle.textContent = isDark ? "Light mode" : "Dark mode";
    themeToggle.setAttribute(
        "aria-label",
        isDark ? "Switch to light mode" : "Switch to dark mode"
    );
}

let savedTheme = null;
try {
    savedTheme = localStorage.getItem(STORAGE.theme);
} catch {
    savedTheme = null;
}

applyTheme(
    savedTheme === "dark" || savedTheme === "light"
        ? savedTheme
        : window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light"
);

themeToggle.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    applyTheme(next);

    try {
        localStorage.setItem(STORAGE.theme, next);
    } catch {
        /* ignore */
    }
});

/* ---------- Marks (CT, Mid, Assignments) ---------- */
const marksForm = document.getElementById("marks-form");
const marksCourseInput = document.getElementById("marks-course");
const marksCtTotalInput = document.getElementById("marks-ct-total");
const marksMidTotalInput = document.getElementById("marks-mid-total");
const marksAttTotalInput = document.getElementById("marks-att-total");
const marksCtWeightInput = document.getElementById("marks-ct-weight");
const marksAssignWeightInput = document.getElementById("marks-assign-weight");
const marksFinalTotalInput = document.getElementById("marks-final-total");
const marksTotalHint = document.getElementById("marks-total-hint");
const marksList = document.getElementById("marks-list");
const marksEmptyMessage = document.getElementById("marks-empty-message");

function toScore(value) {
    const number = typeof value === "number" ? value : parseFloat(value);
    return Number.isFinite(number) && number >= 0 ? number : null;
}

function toPositive(value, fallback) {
    const number = parseFloat(value);
    return Number.isFinite(number) && number > 0 ? number : fallback;
}

function fmt(number) {
    return Number.isInteger(number)
        ? String(number)
        : String(Math.round(number * 100) / 100);
}

let courses = loadList(STORAGE.marks, course =>
    course &&
    typeof course.id === "string" &&
    typeof course.name === "string"
).map(course => ({
    id: course.id,
    name: course.name,
    ctTotal: toPositive(course.ctTotal, 20),
    midTotal: toPositive(course.midTotal, 45),
    attTotal: toPositive(course.attTotal, 15),
    finalTotal: toPositive(course.finalTotal, 180),
    ctWeight: toPositive(course.ctWeight, 45),
    assignWeight: toPositive(course.assignWeight, 15),
    ct: Array.isArray(course.ct) && course.ct.length === 3
        ? course.ct.map(toScore)
        : [null, null, null],
    mid: toScore(course.mid),
    attendance: toScore(course.attendance),
    final: toScore(course.final),
    assignments: Array.isArray(course.assignments)
        ? course.assignments
            .filter(a => a && typeof a.id === "string" && typeof a.title === "string")
            .map(a => ({
                id: a.id,
                title: a.title,
                due: typeof a.due === "string" ? a.due : "",
                total: toPositive(a.total, 10),
                obtained: toScore(a.obtained),
                submitted: a.submitted === true
            }))
        : []
}));

function saveCourses() {
    saveList(STORAGE.marks, courses);
}

/* The best two CT marks are counted and added together
   (if only one CT is entered, just that one is counted). */
function bestTwoCt(course) {
    return course.ct
        .filter(score => score !== null)
        .sort((a, b) => b - a)
        .slice(0, 2);
}

function courseSummary(course) {
    const lines = [];
    const best = bestTwoCt(course);
    const ctGot = best.reduce((sum, score) => sum + score, 0);
    const ctOutOf = 2 * course.ctTotal;
    const ctConverted = (ctGot / ctOutOf) * course.ctWeight;

    const graded = course.assignments.filter(a => a.obtained !== null);
    const assignmentGot = graded.reduce((sum, a) => sum + a.obtained, 0);
    const assignmentOutOf = course.assignments.reduce((sum, a) => sum + a.total, 0);
    const assignmentConverted = assignmentOutOf > 0
        ? (assignmentGot / assignmentOutOf) * course.assignWeight
        : 0;

    lines.push(
        best.length === 0
            ? "Best 2 CT (added): no CT marks yet"
            : `Best 2 CT (added): ${fmt(ctGot)} / ${fmt(ctOutOf)}, converted to ` +
              `${fmt(ctConverted)} / ${fmt(course.ctWeight)}` +
              (best.length < 2 ? " (only 1 CT entered)" : "")
    );

    lines.push(
        course.mid === null
            ? "Mid: no marks yet"
            : `Mid: ${fmt(course.mid)} / ${fmt(course.midTotal)}`
    );

    lines.push(
        graded.length === 0
            ? "Assignments: no marks yet"
            : `Assignments: ${fmt(assignmentGot)} / ${fmt(assignmentOutOf)}, converted to ` +
              `${fmt(assignmentConverted)} / ${fmt(course.assignWeight)}`
    );

    lines.push(
        course.attendance === null
            ? "Attendance & performance: no marks yet"
            : `Attendance & performance: ${fmt(course.attendance)} / ${fmt(course.attTotal)}`
    );

    lines.push(
        course.final === null
            ? "Final: no marks yet"
            : `Final: ${fmt(course.final)} / ${fmt(course.finalTotal)}`
    );

    /* Marks that are not entered yet count as 0 in the total. */
    const maxBeforeFinal = course.ctWeight + course.midTotal + course.assignWeight + course.attTotal;
    const gotBeforeFinal = ctConverted +
        (course.mid === null ? 0 : course.mid) +
        assignmentConverted +
        (course.attendance === null ? 0 : course.attendance);

    const maxTotal = maxBeforeFinal + course.finalTotal;
    const got = gotBeforeFinal + (course.final === null ? 0 : course.final);

    lines.push(`Before final: ${fmt(gotBeforeFinal)} / ${fmt(maxBeforeFinal)}`);
    lines.push(`Total: ${fmt(got)} / ${fmt(maxTotal)} (${Math.round((got / maxTotal) * 100)}%)`);

    return lines;
}

function makeScoreField(id, label, value, total, onSave) {
    const field = document.createElement("div");
    field.className = "field";

    const labelElement = document.createElement("label");
    labelElement.htmlFor = id;
    labelElement.textContent = `${label} (out of ${fmt(total)})`;

    const input = document.createElement("input");
    input.type = "number";
    input.id = id;
    input.min = "0";
    input.max = String(total);
    input.step = "any";
    input.value = value === null ? "" : String(value);

    input.addEventListener("change", () => {
        const raw = input.value.trim();

        if (raw === "") {
            onSave(null);
        } else {
            const number = parseFloat(raw);

            if (!Number.isFinite(number) || number < 0 || number > total) {
                alert(`${label} marks must be between 0 and ${fmt(total)}.`);
                renderMarks();
                return;
            }

            onSave(number);
        }

        saveCourses();
        renderMarks();
    });

    field.append(labelElement, input);
    return field;
}

function renderAssignments(course) {
    const box = document.createElement("div");
    box.className = "assignments";

    const heading = document.createElement("h4");
    heading.textContent = "Assignments";
    box.appendChild(heading);

    const list = document.createElement("ul");
    list.className = "assignment-list";

    course.assignments.forEach(a => {
        const item = document.createElement("li");
        item.className = "assignment-item";

        if (a.submitted) {
            item.classList.add("done");
        }

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = a.submitted;
        checkbox.setAttribute("aria-label", "Mark " + a.title + " as submitted");
        checkbox.addEventListener("change", () => {
            a.submitted = checkbox.checked;
            saveCourses();
            renderMarks();
        });

        const body = document.createElement("div");
        body.className = "task-body";

        const title = document.createElement("span");
        title.className = "task-text";
        title.textContent = a.title;
        body.appendChild(title);

        const chips = document.createElement("div");
        chips.className = "chips";
        chips.appendChild(makeChip(a.submitted ? "Submitted" : "Not submitted", a.submitted ? "low" : ""));

        const due = dueInfo({ due: a.due, completed: a.submitted });
        if (due) {
            chips.appendChild(makeChip(due.text, due.cls));
        }
        body.appendChild(chips);

        const score = makeScoreField(
            `${a.id}-marks`, "Marks", a.obtained, a.total,
            value => { a.obtained = value; }
        );
        score.classList.add("assignment-score");

        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "delete-button";
        deleteButton.textContent = "Delete";
        deleteButton.setAttribute("aria-label", "Delete assignment " + a.title);
        deleteButton.addEventListener("click", () => {
            course.assignments = course.assignments.filter(other => other.id !== a.id);
            saveCourses();
            renderMarks();
        });

        item.append(checkbox, body, score, deleteButton);
        list.appendChild(item);
    });

    box.appendChild(list);

    const form = document.createElement("form");
    form.className = "assignment-form";

    const titleInput = document.createElement("input");
    titleInput.type = "text";
    titleInput.placeholder = "Assignment title";
    titleInput.maxLength = 80;
    titleInput.required = true;
    titleInput.setAttribute("aria-label", "Assignment title");

    const dueInput = document.createElement("input");
    dueInput.type = "date";
    dueInput.setAttribute("aria-label", "Assignment due date");

    const totalInput = document.createElement("input");
    totalInput.type = "number";
    totalInput.min = "1";
    totalInput.step = "any";
    totalInput.value = "10";
    totalInput.required = true;
    totalInput.setAttribute("aria-label", "Assignment total marks");

    const addButton = document.createElement("button");
    addButton.type = "submit";
    addButton.className = "primary-button";
    addButton.textContent = "+ Add Assignment";

    form.append(titleInput, dueInput, totalInput, addButton);

    form.addEventListener("submit", event => {
        event.preventDefault();

        const text = titleInput.value.trim();
        if (!text) {
            return;
        }

        course.assignments.push({
            id: crypto.randomUUID(),
            title: text,
            due: dueInput.value,
            total: toPositive(totalInput.value, 10),
            obtained: null,
            submitted: false
        });

        saveCourses();
        renderMarks();
    });

    box.appendChild(form);
    return box;
}

function renderMarks() {
    marksList.replaceChildren();

    courses.forEach(course => {
        const card = document.createElement("li");
        card.className = "course-card";

        const head = document.createElement("div");
        head.className = "course-head";

        const name = document.createElement("h3");
        name.textContent = course.name;

        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "delete-button";
        deleteButton.textContent = "Delete";
        deleteButton.setAttribute("aria-label", "Delete course " + course.name);
        deleteButton.addEventListener("click", () => {
            if (!confirm(`Delete ${course.name} and all its marks?`)) {
                return;
            }
            courses = courses.filter(other => other.id !== course.id);
            saveCourses();
            renderMarks();
        });

        head.append(name, deleteButton);

        const grid = document.createElement("div");
        grid.className = "score-grid";

        course.ct.forEach((score, index) => {
            grid.appendChild(makeScoreField(
                `${course.id}-ct${index + 1}`, `CT-${index + 1}`, score, course.ctTotal,
                value => { course.ct[index] = value; }
            ));
        });

        grid.appendChild(makeScoreField(
            `${course.id}-mid`, "Mid", course.mid, course.midTotal,
            value => { course.mid = value; }
        ));

        grid.appendChild(makeScoreField(
            `${course.id}-att`, "Attendance & performance", course.attendance, course.attTotal,
            value => { course.attendance = value; }
        ));

        grid.appendChild(makeScoreField(
            `${course.id}-final`, "Final", course.final, course.finalTotal,
            value => { course.final = value; }
        ));

        const summary = document.createElement("ul");
        summary.className = "course-summary";
        courseSummary(course).forEach(line => {
            const row = document.createElement("li");
            row.textContent = line;
            summary.appendChild(row);
        });

        card.append(head, grid, summary, renderAssignments(course));
        marksList.appendChild(card);
    });

    marksEmptyMessage.hidden = courses.length > 0;
}

function updateMarksHint() {
    const total =
        toPositive(marksCtWeightInput.value, 0) +
        toPositive(marksMidTotalInput.value, 0) +
        toPositive(marksAssignWeightInput.value, 0) +
        toPositive(marksAttTotalInput.value, 0) +
        toPositive(marksFinalTotalInput.value, 0);

    marksTotalHint.textContent = `Course total: ${fmt(total)}`;
}

[marksCtWeightInput, marksMidTotalInput, marksAssignWeightInput, marksAttTotalInput, marksFinalTotalInput]
    .forEach(input => input.addEventListener("input", updateMarksHint));

marksForm.addEventListener("submit", event => {
    event.preventDefault();

    const name = marksCourseInput.value.trim();

    if (!name) {
        return;
    }

    courses.push({
        id: crypto.randomUUID(),
        name: name,
        ctTotal: toPositive(marksCtTotalInput.value, 20),
        midTotal: toPositive(marksMidTotalInput.value, 45),
        attTotal: toPositive(marksAttTotalInput.value, 15),
        finalTotal: toPositive(marksFinalTotalInput.value, 180),
        ctWeight: toPositive(marksCtWeightInput.value, 45),
        assignWeight: toPositive(marksAssignWeightInput.value, 15),
        ct: [null, null, null],
        mid: null,
        attendance: null,
        final: null,
        assignments: []
    });

    saveCourses();
    marksCourseInput.value = "";
    renderMarks();
    marksCourseInput.focus();
});

/* ---------- Start ---------- */
updateFilterButtons();
updateExamFilterButtons();
renderTasks();
renderExams();
renderNextExam();
renderMarks();
updateMarksHint();

/* Keep the countdowns fresh without a page reload. */
setInterval(() => {
    renderExams();
    renderNextExam();
    renderTasks();
}, 60000);