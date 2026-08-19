// 创建导出按钮
function createExportButton() {
    const button = document.createElement('button');
    button.innerText = '导出课程表 (demo.ics)';
    button.id = 'xatu-export-ics-btn';
    
    // 设置按钮样式：固定在页面右下角
    Object.assign(button.style, {
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        zIndex: '2147483647', // Max z-index to ensure visibility
        padding: '12px 24px',
        backgroundColor: '#007bff',
        color: 'white',
        border: 'none',
        borderRadius: '12px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)', // Slightly stronger shadow
        cursor: 'pointer',
        fontSize: '16px',
        fontWeight: 'bold',
        transition: 'all 0.3s ease'
    });

    button.onmouseover = () => button.style.backgroundColor = '#0056b3';
    button.onmouseout = () => button.style.backgroundColor = '#007bff';

    // 点击逻辑使用统一的 handleButtonClick
    button.addEventListener('click', handleButtonClick);
    document.body.appendChild(button);
}

// 辅助函数：格式化日期为 ICS UTC 格式 (YYYYMMDDTHHmmSSZ)
function formatDateUTC(date) {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

// 辅助：两位填充
function pad2(n) { return String(n).padStart(2, '0'); }

// ----------------------------------------------------------------------------
// 课程表解析核心逻辑
// ----------------------------------------------------------------------------

function getCourseTableData() {
    const table = document.getElementById('manualArrangeCourseTable');
    if (!table) {
        alert('未找到课程表 (id=manualArrangeCourseTable)，请确认您在正确的课表页面！');
        return null;
    }

    const courses = [];
    const tds = table.querySelectorAll('td[id^="TD"]'); // 选择所有课程单元格

    tds.forEach(td => {
        const title = td.getAttribute('title');
        if (!title) return;

        // 解析 ID 获取时间信息: TD{index}_0
        // index = dayIndex * 12 + sectionIndex (0-based)
        const idMatch = td.id.match(/^TD(\d+)_0$/);
        if (!idMatch) return;

        const index = parseInt(idMatch[1]);
        const dayIndex = Math.floor(index / 12); // 0 = 周一, 1 = 周二...
        const startSection = (index % 12) + 1;   // 1-based 节次
        const rowspan = parseInt(td.getAttribute('rowspan') || '1');
        const endSection = startSection + rowspan - 1;

        // 解析课程内容
        const parts = title.split(';');
        
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i].trim();
            const timeLocMatch = part.match(/^\(?\s*([0-9单双][^,]*),\s*(.*?)\)?$/);
            
            if (timeLocMatch) {
                const weeksStr = timeLocMatch[1];
                const rawLocation = timeLocMatch[2];
                const location = rawLocation.trim(); 

                let nameParts = [];
                for (let j = i - 1; j >= 0; j--) {
                    const prevPart = parts[j] ? parts[j].trim() : '';
                    if (!prevPart) continue;
                    if (prevPart.match(/^\(?\s*([0-9单双][^,]*),\s*(.*?)\)?$/)) {
                        break;
                    }
                    nameParts.unshift(prevPart);
                }

                let courseInfo = nameParts.join(' ');
                if (!courseInfo && courses.length > 0) {
                     courseInfo = courses[courses.length - 1].name; 
                }

                if (courseInfo) {
                    let cleanName = courseInfo;
                    let code = '';
                    let teacher = '';
                    
                    const infoMatch = courseInfo.match(/^(.*?)\(([\w\.\-]+)\)\s*\(([^)]+)\)(.*)$/);
                    if (infoMatch) {
                        cleanName = infoMatch[1].trim() + (infoMatch[4] ? " " + infoMatch[4].trim() : "");
                        code = infoMatch[2];
                        teacher = infoMatch[3];
                    }

                    const cleanLocation = location.replace(/[\(（]未央.*?(?:[\)）]|$)/g, '').trim();

                    if (location.includes('线上教室') || 
                        location.includes('平台修读') ||
                        courseInfo.includes('实践环节选课')) {
                        console.log(`[XATU Extension] 已跳过课程: ${courseInfo} @ ${location}`);
                    } else {
                        courses.push({
                            name: cleanName,
                            rawName: courseInfo,
                            code: code,
                            teacher: teacher,
                            location: cleanLocation,
                            dayIndex: dayIndex, 
                            startSection: startSection,
                            endSection: endSection,
                            weeks: parseWeeks(weeksStr)
                        });
                    }
                }
            }
        }
    });

    return courses;
}

// 解析周次字符串
function parseWeeks(weekStr) {
    const weeks = new Set();
    let type = 0; // 0: all, 1: odd (单), 2: even (双)
    if (weekStr.includes('单')) type = 1;
    if (weekStr.includes('双')) type = 2;

    const cleanStr = weekStr.replace(/[^\d-]/g, ',');
    const parts = cleanStr.split(',');
    parts.forEach(part => {
        if (!part) return;
        if (part.includes('-')) {
            const [start, end] = part.split('-').map(Number);
            if (!isNaN(start) && !isNaN(end)) {
                if (start > 100 || end > 100 || end < start) return; 
                for (let i = start; i <= end; i++) {
                    if (type === 1 && i % 2 === 0) continue; 
                    if (type === 2 && i % 2 !== 0) continue; 
                    weeks.add(i);
                }
            }
        } else {
            const val = Number(part);
            if (!isNaN(val) && val <= 100) {
                if (type === 1 && val % 2 === 0) { }
                else if (type === 2 && val % 2 !== 0) { }
                else { weeks.add(val); }
            }
        }
    });
    return Array.from(weeks);
}

// ----------------------------------------------------------------------------
// ICS 生成逻辑（增加时区支持）
// ----------------------------------------------------------------------------

function generateICS(courses, startDateStr, timezone = 'Asia/Shanghai') {
    const startDate = new Date(startDateStr);

    const sectionTimes = {
        1: { s: '08:20', e: '09:05' },
        2: { s: '09:15', e: '10:00' },
        3: { s: '10:20', e: '11:05' },
        4: { s: '11:15', e: '12:00' },
        5: { s: '14:00', e: '14:45' },
        6: { s: '14:55', e: '15:40' },
        7: { s: '16:00', e: '16:45' },
        8: { s: '16:55', e: '17:40' },
        9: { s: '18:10', e: '18:55' },
        10: { s: '19:05', e: '19:50' },
        11: { s: '20:00', e: '20:45' },
        12: { s: '20:55', e: '21:40' }
    };

    // 将 weekday 索引(0=周一)映射到 RRULE 的 BYDAY
    const weekdays = ['MO','TU','WE','TH','FR','SA','SU'];

    const icsLines = [];

    courses.forEach(course => {
        if (!course.weeks || course.weeks.length === 0) return;

        // 先排序周次
        const weeks = Array.from(new Set(course.weeks)).sort((a,b) => a-b);

        // 将周次拆分为可以表示为固定步长 (1 或 2) 的序列段
        const segments = [];
        let seg = [weeks[0]];
        let segStep = null;
        for (let i = 1; i < weeks.length; i++) {
            const diff = weeks[i] - weeks[i-1];
            if ((diff === 1 || diff === 2)) {
                if (segStep === null) segStep = diff;
                if (segStep === diff) {
                    seg.push(weeks[i]);
                } else {
                    segments.push({weeks: seg.slice(), step: segStep});
                    seg = [weeks[i-1], weeks[i]]; // start new with previous and current
                    segStep = diff;
                }
            } else {
                // diff is irregular (>2), finish current segment and start new singletons
                segments.push({weeks: seg.slice(), step: segStep});
                seg = [weeks[i]];
                segStep = null;
            }
        }
        segments.push({weeks: seg.slice(), step: segStep});

        // 对每个段，生成 RRULE（当长度>=2 且 step 为 1 或 2）或者单次事件
        segments.forEach(s => {
            const segWeeks = s.weeks;
            const step = s.step;

            if (!segWeeks || segWeeks.length === 0) return;

            if (segWeeks.length >= 2 && (step === 1 || step === 2)) {
                // 规则事件（RRULE）
                const firstWeek = segWeeks[0];
                const count = segWeeks.length;

                // 计算第一次发生的日期
                const firstDate = new Date(startDate);
                firstDate.setDate(startDate.getDate() + (firstWeek - 1) * 7 + course.dayIndex);

                const startConf = sectionTimes[course.startSection];
                const endConf = sectionTimes[course.endSection];
                if (!startConf || !endConf) return;

                const [sh, sm] = startConf.s.split(':').map(Number);
                const [eh, em] = endConf.e.split(':').map(Number);

                const y = firstDate.getFullYear();
                const m = pad2(firstDate.getMonth() + 1);
                const d = pad2(firstDate.getDate());
                const shStr = pad2(sh);
                const smStr = pad2(sm);
                const ehStr = pad2(eh);
                const emStr = pad2(em);

                const dtStartLocal = `${y}${m}${d}T${shStr}${smStr}00`;
                const dtEndLocal = `${y}${m}${d}T${ehStr}${emStr}00`;

                const byday = weekdays[course.dayIndex] || 'MO';
                const interval = step;

                const rrule = `FREQ=WEEKLY;INTERVAL=${interval};COUNT=${count};BYDAY=${byday}`;

                icsLines.push(
                    'BEGIN:VEVENT',
                    `UID:${Date.now()}-${Math.random().toString(36).substr(2)}@xatu.edu.cn`,
                    `DTSTAMP:${formatDateUTC(new Date())}`,
                    `DTSTART;TZID=${timezone}:${dtStartLocal}`,
                    `DTEND;TZID=${timezone}:${dtEndLocal}`,
                    `RRULE:${rrule}`,
                    `SUMMARY:${course.name}`,
                    `LOCATION:${course.location}`,
                    `DESCRIPTION:教师: ${course.teacher}\\n课程代码: ${course.code}`,
                    'END:VEVENT'
                );
            } else {
                // 非规则或单次事件：按每个周生成单独 VEVENT
                segWeeks.forEach(wk => {
                    const eventDate = new Date(startDate);
                    eventDate.setDate(startDate.getDate() + (wk - 1) * 7 + course.dayIndex);

                    const startConf = sectionTimes[course.startSection];
                    const endConf = sectionTimes[course.endSection];
                    if (!startConf || !endConf) return;

                    const [sh, sm] = startConf.s.split(':').map(Number);
                    const [eh, em] = endConf.e.split(':').map(Number);

                    const y = eventDate.getFullYear();
                    const m = pad2(eventDate.getMonth() + 1);
                    const d = pad2(eventDate.getDate());
                    const shStr = pad2(sh);
                    const smStr = pad2(sm);
                    const ehStr = pad2(eh);
                    const emStr = pad2(em);

                    const dtStartLocal = `${y}${m}${d}T${shStr}${smStr}00`;
                    const dtEndLocal = `${y}${m}${d}T${ehStr}${emStr}00`;

                    icsLines.push(
                        'BEGIN:VEVENT',
                        `UID:${Date.now()}-${Math.random().toString(36).substr(2)}@xatu.edu.cn`,
                        `DTSTAMP:${formatDateUTC(new Date())}`,
                        `DTSTART;TZID=${timezone}:${dtStartLocal}`,
                        `DTEND;TZID=${timezone}:${dtEndLocal}`,
                        `SUMMARY:${course.name}`,
                        `LOCATION:${course.location}`,
                        `DESCRIPTION:教师: ${course.teacher}\\n课程代码: ${course.code}`,
                        'END:VEVENT'
                    );
                });
            }
        });
    });

    return [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//XATU Extension//CN',
        'CALSCALE:GREGORIAN',
        `X-WR-TIMEZONE:${timezone}`,
        'METHOD:PUBLISH',
        ...icsLines,
        'END:VCALENDAR'
    ].join('\r\n');
}

// ----------------------------------------------------------------------------
// 通信与协调逻辑 (确保按钮始终显示在屏幕右下角)
// ----------------------------------------------------------------------------

const isTop = window === window.top;

// 监听来自其他 Frame 的消息
window.addEventListener('message', (event) => {
    if (!event.data) return;

    if (isTop && event.data.type === 'XATU_SHOW_BTN') {
        createExportButton();
    }

    if (event.data.type === 'XATU_START_EXPORT') {
        const table = document.getElementById('manualArrangeCourseTable');
        if (table) {
            performExport(event.data.startDateStr, event.data.timezone);
        }
    }
});

// 真正的导出执行函数 (在持有表格的 Frame 中运行)
function performExport(startDateStr, timezone = 'Asia/Shanghai') {
    try {
        const courses = getCourseTableData();
        if (!courses || courses.length === 0) {
            alert('未能解析到课程数据，请确保页面已加载完毕。');
            return;
        }
        console.log("解析到的课程:", courses);
        const icsContent = generateICS(courses, startDateStr, timezone);
        downloadFile('xatu_courses.ics', icsContent);
    } catch (e) {
        console.error(e);
        alert('导出失败: ' + e.message);
    }
}

// 显示页面内的日期选择器（在点击导出按钮后弹出）
function showDatePicker(callback) {
    const overlay = document.createElement('div');
    Object.assign(overlay.style, {
        position: 'fixed', left: 0, top: 0, width: '100%', height: '100%',
        background: 'rgba(0,0,0,0.35)', zIndex: '2147483650', display: 'flex', alignItems: 'center', justifyContent: 'center'
    });

    const box = document.createElement('div');
    Object.assign(box.style, {
        background: '#fff', padding: '16px', borderRadius: '8px', width: '320px', boxSizing: 'border-box', boxShadow: '0 6px 18px rgba(0,0,0,0.2)'
    });

    const title = document.createElement('div');
    title.textContent = '请输入本学期第一周的周一日期（YYYY-MM-DD）';
    title.style.marginBottom = '8px';
    title.style.fontSize = '14px';
    title.style.color = '#333';

    const input = document.createElement('input');
    input.type = 'date';
    input.style.width = '100%';
    input.style.padding = '8px';
    input.style.border = '1px solid #e0e0e0';
    input.style.borderRadius = '4px';
    input.style.marginBottom = '12px';

    const defaultDate = (new Date()).toISOString().split('T')[0];
    if (chrome && chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.get(['semesterStartDate'], (res) => {
            input.value = res && res.semesterStartDate ? res.semesterStartDate : defaultDate;
        });
    } else {
        input.value = defaultDate;
    }

    const btnRow = document.createElement('div');
    btnRow.style.display = 'flex';
    btnRow.style.justifyContent = 'flex-end';
    btnRow.style.gap = '8px';

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = '取消';
    Object.assign(cancelBtn.style, { padding: '6px 12px', borderRadius: '12px', background: '#e0e0e0', border: 'none', cursor: 'pointer', transition: 'all 0.3s ease' });

    const okBtn = document.createElement('button');
    okBtn.textContent = '导出并下载';
    Object.assign(okBtn.style, { padding: '6px 12px', borderRadius: '12px', background: '#007bff', color: '#fff', border: 'none', cursor: 'pointer', transition: 'all 0.3s ease' });

    // 与页面导出按钮保持一致的 hover/press 动画效果
    cancelBtn.addEventListener('mouseover', () => {
        cancelBtn.style.background = '#d6d6d6';
        cancelBtn.style.transform = 'translateY(-2px)';
    });
    cancelBtn.addEventListener('mouseout', () => {
        cancelBtn.style.background = '#e0e0e0';
        cancelBtn.style.transform = 'translateY(0)';
    });

    okBtn.addEventListener('mouseover', () => {
        okBtn.style.background = '#0056b3';
        okBtn.style.transform = 'translateY(-2px)';
    });
    okBtn.addEventListener('mouseout', () => {
        okBtn.style.background = '#007bff';
        okBtn.style.transform = 'translateY(0)';
    });

    cancelBtn.addEventListener('click', () => {
        if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    });

    okBtn.addEventListener('click', () => {
        const val = input.value;
        if (!val) {
            alert('请先选择日期');
            return;
        }
        // 保存为默认以便下次快速选择
        if (chrome && chrome.storage && chrome.storage.sync) {
            chrome.storage.sync.set({ semesterStartDate: val });
        }
        if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
        callback(val);
    });

    btnRow.appendChild(cancelBtn);
    btnRow.appendChild(okBtn);

    box.appendChild(title);
    box.appendChild(input);
    box.appendChild(btnRow);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
}

// 按钮点击处理 (只在 Top Frame 触发)
function handleButtonClick() {
    showDatePicker((selectedDate) => {
        const timezone = 'Asia/Shanghai';
        const table = document.getElementById('manualArrangeCourseTable');
        if (table) {
            performExport(selectedDate, timezone);
        } else {
            for (let i = 0; i < window.frames.length; i++) {
                 try {
                     window.frames[i].postMessage({ type: 'XATU_START_EXPORT', startDateStr: selectedDate, timezone }, '*');
                 } catch(e) {
                     console.log(e);
                 }
            }
        }
    });
}

let buttonCreated = false;
function createExportButton() {
    if (buttonCreated) return;
    
    const button = document.createElement('button');
    button.id = 'xatu-export-ics-btn';

    button.innerHTML = `<span>📆 导出课程表</span>    `;
    
    // 样式：固定在 Top Frame 的右下角，即屏幕右下角
    Object.assign(button.style, {
        position: 'fixed',
        bottom: '20px',
        right: '25px', // 稍微往里一点避免滚动条干扰
        zIndex: '2147483647',
        padding: '12px 24px',
        backgroundColor: '#007bff',
        color: 'white',
        border: 'none',
        borderRadius: '12px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)', // 加强阴影确保在白色背景上明显
        cursor: 'pointer',
        fontSize: '16px',
        fontWeight: 'bold',
        transition: 'all 0.3s ease',
        fontFamily: 'Microsoft YaHei, sans-serif',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
    });

    button.onmouseover = () => {
        button.style.backgroundColor = '#0056b3';
        button.style.transform = 'translateY(-2px)';
    };
    button.onmouseout = () => {
        button.style.backgroundColor = '#007bff';
        button.style.transform = 'translateY(0)';
    };

    button.addEventListener('click', handleButtonClick);
    document.body.appendChild(button);
    buttonCreated = true;
}

// 辅助函数：触发下载
function downloadFile(filename, content) {
    const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// 页面加载/变化检测逻辑
function checkAndInit() {
    const table = document.getElementById('manualArrangeCourseTable');
    if (table) {
        // 如果当前 Frame 发现了表格
        if (isTop) {
            // 如果自己就是 Top，直接显示按钮
            createExportButton();
        } else {
            // 如果是子 Frame，告诉 Top 显示按钮
            window.top.postMessage({ type: 'XATU_SHOW_BTN' }, '*');
        }
    }
}

const observer = new MutationObserver(() => {
    checkAndInit();
});

observer.observe(document.body || document.documentElement, {
    childList: true,
    subtree: true
});

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkAndInit);
} else {
    checkAndInit();
}
