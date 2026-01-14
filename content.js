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
        borderRadius: '50px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)', // Slightly stronger shadow
        cursor: 'pointer',
        fontSize: '16px',
        fontWeight: 'bold',
        transition: 'all 0.3s ease'
    });

    button.onmouseover = () => button.style.backgroundColor = '#0056b3';
    button.onmouseout = () => button.style.backgroundColor = '#007bff';

    button.addEventListener('click', exportDemoICS);
    document.body.appendChild(button);
}

// 辅助函数：格式化日期为 ICS 格式 (YYYYMMDDTHHmmSS)
function formatDate(date) {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

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
        // 格式假设: "CourseInfo (Teacher);;;(Weeks,Location)"
        // 策略: 按分号分割，找到 (周次,地点) 的片段，其前一个非空片段即为课程信息
        const parts = title.split(';');
        
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i].trim();
            // 优化后的正则：以第一个逗号为界，且要求周次必须以数字或"单"、"双"开头
            // 匹配示例：(1-16,教3-412) 或 1-16(双),教3-412 或 (单7-11, ...
            // 避免匹配到 "课程名称, 副标题" 这种非时间格式
            const timeLocMatch = part.match(/^\(?\s*([0-9单双][^,]*),\s*(.*?)\)?$/);
            
            if (timeLocMatch) {
                const weeksStr = timeLocMatch[1];
                // 这里的 capture group 2 是地点部分，可能包含剩下的所有内容（包括多个地点）
                const rawLocation = timeLocMatch[2];
                // 修正：不再移除结尾的括号，避免误删地点自带的括号（如 "教1-203(未央)"）
                // 之前的代码 .replace(/\)$/, '') 会导致 "教1-203(未央)" 变成 "教1-203(未央"，从而导致后续清理正则匹配失败
                const location = rawLocation.trim(); 

                // 向前寻找课程信息
                // 策略：回溯直到遇到上一个时间段（因为 split(';') 会把所有时间段和平铺）
                // 收集这之间的所有文本片段，通常第一个是课程名，后面的是注释
                let nameParts = [];
                for (let j = i - 1; j >= 0; j--) {
                    const prevPart = parts[j] ? parts[j].trim() : '';
                    if (!prevPart) continue;

                    // 检查这个片段是否也是时间地点格式
                    // 如果是，说明碰到了上一个课程的时间段，必须停止
                    // 必须保持正则一致
                    if (prevPart.match(/^\(?\s*([0-9单双][^,]*),\s*(.*?)\)?$/)) {
                        break;
                    }
                    // 否则认为是课程名称或注释，添加到开头
                    nameParts.unshift(prevPart);
                }

                // 拼接片段作为课程名，例如 "数字电子技术 (计数器实验)"
                // 这样既保留了注释，又不会让注释变成独立的课程名
                let courseInfo = nameParts.join(' ');
                
                // 如果没找到课程名（可能是 Time2 紧跟 Time1 且前面没有课程名），
                // 尝试复用上一次找到的课程名（针对 Course; Time1; Time2 结构）
                if (!courseInfo && courses.length > 0) {
                     // 简单启发式：如果在同一个单元格内，且没找到新名字，可能属于同一个课程
                     courseInfo = courses[courses.length - 1].name; 
                }

                if (courseInfo) {
                    // 解析课程名、编号、教师
                    // 格式通常为: "数字电子技术(060032.04) (赵世峰) (计数器实验)"
                    // 或 "复变函数(0069.07) (宋达霞)"
                    let cleanName = courseInfo;
                    let code = '';
                    let teacher = '';
                    
                    // 正则提取：匹配 名字(编号) (老师) 剩余部分
                    // ([\w\.\-]+) 匹配编号，([^)]+) 匹配老师
                    const infoMatch = courseInfo.match(/^(.*?)\(([\w\.\-]+)\)\s*\(([^)]+)\)(.*)$/);
                    if (infoMatch) {
                        cleanName = infoMatch[1].trim() + (infoMatch[4] ? " " + infoMatch[4].trim() : "");
                        code = infoMatch[2];
                        teacher = infoMatch[3];
                    }

                    // 清理地点：移除各种括号包裹的"未央"字样，保留其他内容
                    // 例如 "工1-202(未央),工1-204(未央)" -> "工1-202,工1-204"
                    // 修正：增加 |$) 以兼容末尾半个括号被截断的情况（因为 timeLocMatch 可能会吃掉最后一个闭合括号）
                    const cleanLocation = location.replace(/[\(（]未央.*?(?:[\)）]|$)/g, '').trim();

                    // 过滤特定的线上/平台修读课程，以及特定的实践环节课程
                    if (location.includes('线上教室') || 
                        location.includes('平台修读') ||
                        courseInfo.includes('实践环节选课')) {
                        console.log(`[XATU Extension] 已跳过课程: ${courseInfo} @ ${location}`);
                    } else {
                        courses.push({
                            name: cleanName,    // 仅课程名 + 注释
                            rawName: courseInfo,// 保留原始完整名用于排错
                            code: code,         // 课程编号
                            teacher: teacher,   // 教师
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

// 解析周次字符串 "1-4,7-10(单)" -> [1,2,3,4,7,9]
// 兼容 "1-14 16-17" 这种用空格分隔的情况
function parseWeeks(weekStr) {
    const weeks = new Set();
    // 预处理：识别单双周模式
    let type = 0; // 0: all, 1: odd (单), 2: even (双)
    if (weekStr.includes('单')) type = 1;
    if (weekStr.includes('双')) type = 2;

    // 将非数字、非连字符的字符（包括空格、逗号、括号、中文等）统一替换为逗号
    // 例如 "1-14 16-17" -> "1-14,16-17"
    // "1-16(双)" -> "1-16,,,"
    const cleanStr = weekStr.replace(/[^\d-]/g, ',');
    
    const parts = cleanStr.split(',');
    parts.forEach(part => {
        if (!part) return; // 跳过空项

        if (part.includes('-')) {
            const [start, end] = part.split('-').map(Number);
            if (!isNaN(start) && !isNaN(end)) {
                // 安全检查：防止解析到非周次的巨大数值
                if (start > 100 || end > 100 || end < start) {
                    console.warn(`[XATU Extension] 忽略异常周次范围: ${start}-${end}`);
                    return; 
                }

                for (let i = start; i <= end; i++) {
                    if (type === 1 && i % 2 === 0) continue; 
                    if (type === 2 && i % 2 !== 0) continue; 
                    weeks.add(i);
                }
            }
        } else {
            const val = Number(part);
            if (!isNaN(val)) {
                if (val > 100) return; 
                 if (type === 1 && val % 2 === 0) { /* skip */ }
                 else if (type === 2 && val % 2 !== 0) { /* skip */ }
                 else { weeks.add(val); }
            }
        }
    });
    return Array.from(weeks);
}

// ----------------------------------------------------------------------------
// ICS 生成逻辑
// ----------------------------------------------------------------------------

function generateICS(courses, startDateStr) {
    const startDate = new Date(startDateStr);
    
    // 西安工大作息时间表 (根据用户提供的时间更新)
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

    // 1. 展开所有课程为独立的【单次课事件】对象
    let allEvents = [];
    courses.forEach(course => {
        course.weeks.forEach(week => {
            // 计算日期
            const eventDate = new Date(startDate);
            eventDate.setDate(startDate.getDate() + (week - 1) * 7 + course.dayIndex);
            const dateStr = eventDate.toISOString().split('T')[0]; // YYYY-MM-DD 用于分组

            allEvents.push({
                name: course.name,
                code: course.code,
                teacher: course.teacher,
                location: course.location,
                dateStr: dateStr,
                dateObj: eventDate, // 确保这个属性是 Date 对象
                startSection: course.startSection,
                endSection: course.endSection,
                week: week
            });
        });
    });

    // 2. 排序：按日期 -> 开始节次 排序
    allEvents.sort((a, b) => {
        if (a.dateStr !== b.dateStr) return a.dateStr.localeCompare(b.dateStr);
        return a.startSection - b.startSection;
    });

    // 3. 合并逻辑
    const mergedEvents = [];
    if (allEvents.length > 0) {
        let current = allEvents[0];
        
        for (let i = 1; i < allEvents.length; i++) {
            const next = allEvents[i];
            
            // 判断是否可以合并：
            // 1. 同一天
            // 2. 同一门课（名字、地点相同）
            // 3. 节次连续 (上一节结束 + 1 == 下一节开始) 
            //    或者在这个特定的作息表中，节次是物理连续的（比如1-2和3-4其实中间有休息，但在逻辑上是连续的）
            //    这里我们使用 loose 连续判断：只要是同一天的后续课程，且中间没有夹杂其他课，通常就是大课
            //    严格一点：endSection + 1 === startSection
            
            if (current.dateStr === next.dateStr &&
                current.name === next.name &&
                current.location === next.location &&
                current.endSection + 1 === next.startSection) {
                
                // 合并：更新结束节次
                current.endSection = next.endSection;
            } else {
                // 无法合并，推入当前，并开始新的
                mergedEvents.push(current);
                current = next;
            }
        }
        mergedEvents.push(current); // 推入最后一个
    }

    // 4. 生成 ICS 字符串
    const icsRunningLines = mergedEvents.map(evt => {
        const startConf = sectionTimes[evt.startSection];
        const endConf = sectionTimes[evt.endSection];
        
        if (!startConf || !endConf) return null;

        const [sh, sm] = startConf.s.split(':').map(Number);
        const [eh, em] = endConf.e.split(':').map(Number);
        
        const dtStart = new Date(evt.dateObj);
        dtStart.setHours(sh, sm, 0);
        
        const dtEnd = new Date(evt.dateObj);
        dtEnd.setHours(eh, em, 0);

        return [
            'BEGIN:VEVENT',
            `UID:${Date.now()}-${Math.random().toString(36).substr(2)}@xatu.edu.cn`,
            `DTSTAMP:${formatDate(new Date())}`,
            `DTSTART:${formatDate(dtStart)}`,
            `DTEND:${formatDate(dtEnd)}`,
            `SUMMARY:${evt.name}`,
            `LOCATION:${evt.location}`,
            `DESCRIPTION:教师: ${evt.teacher}\\n课程代码: ${evt.code}`,
            'END:VEVENT'
        ].join('\r\n');
    }).filter(Boolean); // 过滤掉无效时间的

    return [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//XATU Extension//CN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        ...icsRunningLines,
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

    // Case A: 子 Frame 告诉 Top Frame "显示按钮"
    // (此消息由子 Frame 发出，只在 Top Frame 响应)
    if (isTop && event.data.type === 'XATU_SHOW_BTN') {
        createExportButton();
    }

    // Case B: Top Frame 告诉子 Frame "开始导出"
    // (此消息由 Top Frame 发出，只在持有表格的 Frame 响应)
    if (event.data.type === 'XATU_START_EXPORT') {
        const table = document.getElementById('manualArrangeCourseTable');
        if (table) {
            // 在当前 Frame 执行导出
            performExport(event.data.startDateStr);
        }
    }
});

// 真正的导出执行函数 (在持有表格的 Frame 中运行)
function performExport(startDateStr) {
    try {
        const courses = getCourseTableData();
        if (!courses || courses.length === 0) {
            alert('未能解析到课程数据，请确保页面已加载完毕。');
            return;
        }
        
        console.log("解析到的课程:", courses);
        const icsContent = generateICS(courses, startDateStr);
        downloadFile('xatu_courses.ics', icsContent);
    } catch (e) {
        console.error(e);
        alert('导出失败: ' + e.message);
    }
}

// 按钮点击处理 (只在 Top Frame 触发)
function handleButtonClick() {
    const startDateStr = prompt("请输入本学期第一周周一的日期 (格式: YYYY-MM-DD):", "2024-09-02");
    if (!startDateStr) return;

    // 1. 如果 Top Frame 自己就有表格，直接导出
    const table = document.getElementById('manualArrangeCourseTable');
    if (table) {
        performExport(startDateStr);
    } 
    // 2. 否则，广播给所有子 Frames，让它们尝试导出
    else {
        // 尝试通过 window.frames 遍历 (兼容 iframe 和 frameset)
        for (let i = 0; i < window.frames.length; i++) {
             try {
                 window.frames[i].postMessage({ type: 'XATU_START_EXPORT', startDateStr }, '*');
             } catch(e) {
                 // 可能会遇到跨域限制，但在同源教务系统中通常没事
                 console.log(e);
             }
        }
    }
}

let buttonCreated = false;
function createExportButton() {
    if (buttonCreated) return;
    
    const button = document.createElement('button');
    button.id = 'xatu-export-ics-btn';

    // 使用 chrome.runtime.getURL 引用扩展内的图标
    const iconUrl = chrome.runtime.getURL('images/icon32.png');
    button.innerHTML = `
        <img src="${iconUrl}" style="width: 20px; height: 20px; margin-right: 8px; display: block;">
        <span>导出课程表</span>
    `;
    
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
        borderRadius: '50px',
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
