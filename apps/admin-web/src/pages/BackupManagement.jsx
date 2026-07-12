import { useCallback, useEffect, useMemo, useState } from "react";
import { CloudUpload, Download, RefreshCw } from "lucide-react";
import {
  listBackupFiles,
  restoreBackupByFile,
  restoreLatestBackup,
  runBackupNow,
} from "@/lib/api";
import { RESTORE_CONFIRM_PHRASE } from "@/lib/config";
import { Alert } from "@/utils/dialog";
import Spinner from "@/components/ui/Spinner";
import PageHeader from "@/components/ui/PageHeader";

function formatBytes(size) {
  const n = Number(size || 0);
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default function BackupManagement() {
  const [loading, setLoading] = useState(true);
  const [backingUp, setBackingUp] = useState(false);
  const [restoringLatest, setRestoringLatest] = useState(false);
  const [restoringFileName, setRestoringFileName] = useState("");
  const [files, setFiles] = useState([]);

  const refreshFiles = useCallback(async () => {
    try {
      setLoading(true);
      setFiles(await listBackupFiles());
    } catch (error) {
      Alert.alert("Error", error?.response?.data?.message || "Failed to fetch backups");
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshFiles();
  }, [refreshFiles]);

  const latestFile = useMemo(() => (files.length ? files[0] : null), [files]);

  const confirmRestoreAction = (action) => {
    Alert.alert("Restore Confirmation", "This will overwrite current database data. Continue?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Restore",
        style: "destructive",
        onPress: () => {
          Alert.alert(
            "Final Confirmation",
            "Are you absolutely sure? This action cannot be undone.",
            [
              { text: "Cancel", style: "cancel" },
              { text: "Yes, Restore", style: "destructive", onPress: action },
            ]
          );
        },
      },
    ]);
  };

  const onRunBackupNow = async () => {
    try {
      setBackingUp(true);
      await runBackupNow();
      Alert.alert("Success", "Backup completed successfully.");
      await refreshFiles();
    } catch (error) {
      Alert.alert("Backup Failed", error?.response?.data?.message || "Could not run backup");
    } finally {
      setBackingUp(false);
    }
  };

  const onRestoreLatest = () => {
    if (restoringLatest) return;
    confirmRestoreAction(async () => {
      try {
        setRestoringLatest(true);
        const result = await restoreLatestBackup(RESTORE_CONFIRM_PHRASE);
        Alert.alert("Restore Complete", `Restored latest backup: ${result?.restoredFileName || "unknown"}`);
      } catch (error) {
        Alert.alert("Restore Failed", error?.response?.data?.message || "Could not restore");
      } finally {
        setRestoringLatest(false);
      }
    });
  };

  const onRestoreFile = (fileName) => {
    if (!fileName || restoringFileName) return;
    confirmRestoreAction(async () => {
      try {
        setRestoringFileName(fileName);
        await restoreBackupByFile(fileName, RESTORE_CONFIRM_PHRASE);
        Alert.alert("Restore Complete", `Restored backup: ${fileName}`);
      } catch (error) {
        Alert.alert("Restore Failed", error?.response?.data?.message || "Could not restore");
      } finally {
        setRestoringFileName("");
      }
    });
  };

  return (
    <div>
      <PageHeader title="Backup Management" />
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <button type="button" className="btn-primary" onClick={onRunBackupNow} disabled={backingUp}>
          {backingUp ? <Spinner className="h-4 w-4 border-white/30 border-t-white" label="" /> : <CloudUpload className="h-4 w-4" />}
          {backingUp ? "Running Backup…" : "Run Backup Now"}
        </button>
        <button type="button" className="btn-danger" onClick={onRestoreLatest} disabled={restoringLatest}>
          {restoringLatest ? <Spinner className="h-4 w-4 border-white/30 border-t-white" label="" /> : <Download className="h-4 w-4" />}
          {restoringLatest ? "Restoring…" : "Restore Latest Backup"}
        </button>
        <button type="button" className="btn-secondary" onClick={refreshFiles} disabled={loading}>
          <RefreshCw className="h-4 w-4" />
          Refresh List
        </button>
      </div>

      {latestFile ? (
        <div className="card-panel mt-6">
          <p className="text-xs font-medium uppercase text-slate-500">Latest Backup</p>
          <p className="mt-1 font-bold text-slate-900">{latestFile.name}</p>
          <p className="text-sm text-slate-500">
            {new Date(latestFile.modTime || Date.now()).toLocaleString()} • {formatBytes(latestFile.size)}
          </p>
        </div>
      ) : null}

      {loading ? (
        <div className="mt-12 flex justify-center">
          <Spinner />
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {files.length === 0 ? (
            <p className="text-center text-slate-500">No backups found.</p>
          ) : (
            files.map((item) => {
              const restoringThis = restoringFileName === item.name;
              return (
                <div key={item.name} className="card-panel flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold text-slate-900">{item.name}</p>
                    <p className="text-sm text-slate-500">
                      {new Date(item.modTime || Date.now()).toLocaleString()} • {formatBytes(item.size)}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn-primary shrink-0"
                    onClick={() => onRestoreFile(item.name)}
                    disabled={!!restoringFileName}
                  >
                    {restoringThis ? <Spinner className="h-4 w-4 border-white/30 border-t-white" label="" /> : <Download className="h-4 w-4" />}
                    Restore
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
