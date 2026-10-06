using System;
using System.Runtime.InteropServices;
using System.Text;

namespace ClassYesMove
{
    /// <summary>The Windows calls the helper needs, and nothing more.</summary>
    internal static class Native
    {
        [StructLayout(LayoutKind.Sequential)]
        public struct POINT
        {
            public int X, Y;
            public POINT(int x, int y) { X = x; Y = y; }
        }

        [StructLayout(LayoutKind.Sequential)]
        public struct RECT
        {
            public int Left, Top, Right, Bottom;
            public int Width => Right - Left;
            public int Height => Bottom - Top;
            public override string ToString() => $"({Left},{Top}) {Width}x{Height}";
        }

        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
        public struct MONITORINFO
        {
            public int cbSize;
            public RECT rcMonitor;
            public RECT rcWork;
            public uint dwFlags;
        }

        [StructLayout(LayoutKind.Sequential)]
        public struct POINTER_INFO
        {
            public int pointerType;
            public uint pointerId;
            public uint frameId;
            public uint pointerFlags;
            public IntPtr sourceDevice;
            public IntPtr hwndTarget;
            public POINT ptPixelLocation;
            public POINT ptHimetricLocation;
            public POINT ptPixelLocationRaw;
            public POINT ptHimetricLocationRaw;
            public uint dwTime;
            public uint historyCount;
            public int inputData;
            public uint dwKeyStates;
            public ulong PerformanceCount;
            public int ButtonChangeType;
        }

        [StructLayout(LayoutKind.Sequential)]
        public struct POINTER_TOUCH_INFO
        {
            public POINTER_INFO pointerInfo;
            public uint touchFlags;
            public uint touchMask;
            public RECT rcContact;
            public RECT rcContactRaw;
            public uint orientation;
            public uint pressure;
        }

        [StructLayout(LayoutKind.Sequential)]
        public struct MOUSEINPUT
        {
            public int dx, dy;
            public uint mouseData, dwFlags, time;
            public IntPtr dwExtraInfo;
        }

        [StructLayout(LayoutKind.Sequential)]
        public struct INPUT
        {
            public uint type;
            // The union's other members (keyboard, hardware) are no bigger than a mouse input.
            public MOUSEINPUT mi;
        }

        public const int GWL_STYLE = -16;
        public const int GWL_EXSTYLE = -20;
        public const long WS_THICKFRAME = 0x00040000;
        public const long WS_CAPTION = 0x00C00000;
        public const long WS_EX_TOPMOST = 0x00000008;
        public const long WS_EX_TOOLWINDOW = 0x00000080;
        public const long WS_EX_NOACTIVATE = 0x08000000;

        public static readonly IntPtr HWND_TOPMOST = new IntPtr(-1);
        public const uint SWP_NOSIZE = 0x0001;
        public const uint SWP_NOMOVE = 0x0002;
        public const uint SWP_NOZORDER = 0x0004;
        public const uint SWP_NOACTIVATE = 0x0010;
        public const uint SWP_NOOWNERZORDER = 0x0200;
        public const uint SWP_ASYNCWINDOWPOS = 0x4000;

        public const int WM_POINTERUPDATE = 0x0245;
        public const int WM_POINTERDOWN = 0x0246;
        public const int WM_POINTERUP = 0x0247;
        public const int WM_POINTERCAPTURECHANGED = 0x024C;
        public const int WM_CONTEXTMENU = 0x007B;
        public const int WM_RBUTTONDOWN = 0x0204;
        public const int WM_RBUTTONUP = 0x0205;
        public const int WM_MOUSEACTIVATE = 0x0021;
        public const int WM_MOUSEMOVE = 0x0200;
        public const int WM_LBUTTONDOWN = 0x0201;
        public const int WM_LBUTTONUP = 0x0202;
        public const int WM_CAPTURECHANGED = 0x0215;
        public const int MA_NOACTIVATE = 3;

        public const int PT_TOUCH = 2;
        public const int PT_PEN = 3;
        public const uint POINTER_FLAG_INRANGE = 0x00000002;
        public const uint POINTER_FLAG_INCONTACT = 0x00000004;
        public const uint POINTER_FLAG_DOWN = 0x00010000;
        public const uint POINTER_FLAG_UPDATE = 0x00020000;
        public const uint POINTER_FLAG_UP = 0x00040000;
        public const uint TOUCH_MASK_CONTACTAREA = 0x00000001;
        public const uint TOUCH_MASK_ORIENTATION = 0x00000002;
        public const uint TOUCH_MASK_PRESSURE = 0x00000004;

        /// <summary>The Tablet PC flags a window sets on itself: no press-and-hold right-click, no flicks.</summary>
        public const string TabletPenServiceProperty = "MicrosoftTabletPenServiceProperty";
        public const int TABLET_DISABLE_PRESSANDHOLD = 0x00000001;
        public const int TABLET_DISABLE_PENTAPFEEDBACK = 0x00000008;
        public const int TABLET_DISABLE_PENBARRELFEEDBACK = 0x00000010;
        public const int TABLET_DISABLE_FLICKS = 0x00010000;

        public const uint MONITOR_DEFAULTTONEAREST = 2;
        public const int DWMWA_EXTENDED_FRAME_BOUNDS = 9;
        public const uint INPUT_MOUSE = 0;
        public const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
        public const uint MOUSEEVENTF_LEFTUP = 0x0004;
        public static readonly IntPtr DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2 = new IntPtr(-4);
        public const uint PROCESS_QUERY_LIMITED_INFORMATION = 0x1000;

        public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

        [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc callback, IntPtr lParam);
        [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetClassName(IntPtr hWnd, StringBuilder name, int max);
        [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int max);
        [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
        [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr hWnd);
        [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);
        [DllImport("user32.dll", EntryPoint = "GetWindowLongPtrW")] public static extern IntPtr GetWindowLongPtr(IntPtr hWnd, int index);
        [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);
        [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr hWnd, IntPtr after, int x, int y, int cx, int cy, uint flags);
        [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
        [DllImport("user32.dll")] public static extern uint GetDpiForWindow(IntPtr hWnd);
        [DllImport("user32.dll")] public static extern bool SetProcessDpiAwarenessContext(IntPtr value);
        [DllImport("user32.dll")] public static extern bool GetPointerInfo(uint pointerId, out POINTER_INFO info);
        [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern bool SetProp(IntPtr hWnd, string name, IntPtr data);
        [DllImport("user32.dll")] public static extern IntPtr MonitorFromWindow(IntPtr hWnd, uint flags);
        [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern bool GetMonitorInfo(IntPtr monitor, ref MONITORINFO info);
        [DllImport("user32.dll")] public static extern uint SendInput(uint count, INPUT[] inputs, int size);
        [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
        [DllImport("user32.dll")] public static extern IntPtr SetCapture(IntPtr hWnd);
        [DllImport("user32.dll")] public static extern uint GetMessagePos();
        [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
        [DllImport("user32.dll")] public static extern bool ReleaseCapture();
        [DllImport("user32.dll", SetLastError = true)] public static extern bool InitializeTouchInjection(uint maxCount, uint mode);
        [DllImport("user32.dll", SetLastError = true)] public static extern bool InjectTouchInput(uint count, [In] POINTER_TOUCH_INFO[] contacts);
        [DllImport("dwmapi.dll")] public static extern int DwmGetWindowAttribute(IntPtr hWnd, int attribute, out RECT value, int size);
        [DllImport("kernel32.dll")] public static extern IntPtr OpenProcess(uint access, bool inherit, uint processId);
        [DllImport("kernel32.dll", CharSet = CharSet.Unicode)] public static extern bool QueryFullProcessImageName(IntPtr process, int flags, StringBuilder name, ref int size);
        [DllImport("kernel32.dll")] public static extern bool CloseHandle(IntPtr handle);

        public static string ClassOf(IntPtr hWnd)
        {
            var sb = new StringBuilder(256);
            GetClassName(hWnd, sb, sb.Capacity);
            return sb.ToString();
        }

        public static string TitleOf(IntPtr hWnd)
        {
            var sb = new StringBuilder(512);
            GetWindowText(hWnd, sb, sb.Capacity);
            return sb.ToString();
        }

        public static long Style(IntPtr hWnd) => GetWindowLongPtr(hWnd, GWL_STYLE).ToInt64();
        public static long ExStyle(IntPtr hWnd) => GetWindowLongPtr(hWnd, GWL_EXSTYLE).ToInt64();

        /// <summary>The program a window belongs to, like "chrome.exe".</summary>
        public static string ProgramOf(IntPtr hWnd)
        {
            GetWindowThreadProcessId(hWnd, out uint pid);
            IntPtr process = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid);
            if (process == IntPtr.Zero) return "";
            try
            {
                var sb = new StringBuilder(1024);
                int size = sb.Capacity;
                return QueryFullProcessImageName(process, 0, sb, ref size) ? System.IO.Path.GetFileName(sb.ToString()).ToLowerInvariant() : "";
            }
            finally
            {
                CloseHandle(process);
            }
        }

        /// <summary>
        /// Where the window's visible edges are. On Windows 10 and 11 a window's rectangle includes
        /// invisible resize borders; the tab should sit against what can be seen.
        /// </summary>
        public static RECT VisibleBounds(IntPtr hWnd)
        {
            if (DwmGetWindowAttribute(hWnd, DWMWA_EXTENDED_FRAME_BOUNDS, out RECT r, Marshal.SizeOf(typeof(RECT))) == 0 && r.Width > 0) return r;
            GetWindowRect(hWnd, out r);
            return r;
        }

        /// <summary>The usable part of the screen the window is on: the taskbar left out.</summary>
        public static RECT WorkAreaOf(IntPtr hWnd)
        {
            var info = new MONITORINFO { cbSize = Marshal.SizeOf(typeof(MONITORINFO)) };
            GetMonitorInfo(MonitorFromWindow(hWnd, MONITOR_DEFAULTTONEAREST), ref info);
            return info.rcWork;
        }
    }
}
