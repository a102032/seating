# A real finger on a Windows desktop, for the Move grip's check on GitHub's Windows computers: Windows'
# own touch input (InjectTouchInput), so Chrome gets the same touch messages a board or a touch laptop
# sends - the made-up pointer events of a browser test don't go through Chrome's touch path at all,
# which is where the grip stuttered on the teacher's laptop and nowhere in those tests.
# Positions are real screen pixels. The finger goes down at X,Y, stays there for HoldMs (as a finger
# on a board jitters, it is re-sent every 30 ms), slides by DX,DY in Steps moves StepMs apart, and lifts.
param(
  [int]$X, [int]$Y, [int]$DX, [int]$DY,
  [int]$HoldMs = 0, [int]$Steps = 40, [int]$StepMs = 16
)

Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Threading;

public static class Finger
{
    [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X, Y; }
    [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }

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

    [DllImport("user32.dll", SetLastError = true)] static extern bool InitializeTouchInjection(uint maxCount, uint mode);
    [DllImport("user32.dll", SetLastError = true)] static extern bool InjectTouchInput(uint count, [In] POINTER_TOUCH_INFO[] contacts);
    [DllImport("user32.dll")] static extern IntPtr SetThreadDpiAwarenessContext(IntPtr context);

    const uint DOWN = 0x00010000, UPDATE = 0x00020000, UP = 0x00040000, INRANGE = 0x2, INCONTACT = 0x4;

    static bool Send(int x, int y, uint flags)
    {
        var c = new POINTER_TOUCH_INFO();
        c.pointerInfo.pointerType = 2; // touch
        c.pointerInfo.pointerId = 0;
        c.pointerInfo.pointerFlags = flags;
        c.pointerInfo.ptPixelLocation = new POINT { X = x, Y = y };
        c.touchMask = 0x7; // contact area, orientation, pressure
        c.orientation = 90;
        c.pressure = 32000;
        c.rcContact = new RECT { Left = x - 4, Top = y - 4, Right = x + 4, Bottom = y + 4 };
        return InjectTouchInput(1, new[] { c });
    }

    public static string Slide(int x, int y, int dx, int dy, int holdMs, int steps, int stepMs)
    {
        // Real pixels whatever Windows' scaling: per-monitor aware, or Windows rescales what is sent.
        SetThreadDpiAwarenessContext(new IntPtr(-4));
        if (!InitializeTouchInjection(1, 3)) return "no touch injection: " + Marshal.GetLastWin32Error();
        if (!Send(x, y, DOWN | INRANGE | INCONTACT)) return "down failed: " + Marshal.GetLastWin32Error();
        for (int t = 0; t < holdMs; t += 30)
        {
            Thread.Sleep(30);
            Send(x, y, UPDATE | INRANGE | INCONTACT);
        }
        for (int i = 1; i <= steps; i++)
        {
            Thread.Sleep(stepMs);
            Send(x + dx * i / steps, y + dy * i / steps, UPDATE | INRANGE | INCONTACT);
        }
        Thread.Sleep(stepMs);
        if (!Send(x + dx, y + dy, UP)) return "up failed: " + Marshal.GetLastWin32Error();
        return "ok";
    }
}
'@

[Finger]::Slide($X, $Y, $DX, $DY, $HoldMs, $Steps, $StepMs)
