using System;
using System.Threading;
using System.Windows.Forms;

namespace ClassYesMove
{
    internal static class Program
    {
        [STAThread]
        static int Main(string[] args)
        {
            // Real pixels on every screen (the manifest says so too; this covers a Windows that ignores it).
            Native.SetProcessDpiAwarenessContext(Native.DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2);
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            if (args.Length > 0 && args[0] == "--self-test") return SelfTest.Run(args.Length > 1 ? args[1] : "self-test");

            // One at a time: two would hang two tabs off the same window.
            using (var one = new Mutex(true, @"Local\ClassYesMoveTab", out bool first))
            {
                if (!first)
                {
                    MessageBox.Show(
                        "The Move tab is already on.\nTap Float in Class? Yes! and look under the floating window.",
                        "Class? Yes! Move tab"
                    );
                    return 0;
                }
                Application.Run(new TrayApp());
            }
            return 0;
        }
    }
}
