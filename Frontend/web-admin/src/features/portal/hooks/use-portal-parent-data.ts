import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

import { UI_MESSAGES } from "../../../shared/i18n";
import { toUiErrorMessage } from "../../../shared/services/api-errors";
import { fetchParentPortalData } from "../services/portal-parent-service";
import type { ParentPortalData, PortalApiClient } from "../types/portal-parent";

type UsePortalParentDataOptions = {
  api: PortalApiClient;
  initialData: ParentPortalData;
  remoteEnabled?: boolean;
  onDataChange?: (data: ParentPortalData) => void;
  onError: (message: string | null) => void;
};

export const usePortalParentData = ({
  api,
  initialData,
  remoteEnabled = true,
  onDataChange,
  onError
}: UsePortalParentDataOptions) => {
  const [data, setData] = useState<ParentPortalData>(initialData);
  const [studentFilter, setStudentFilter] = useState("");
  const onDataChangeRef = useRef(onDataChange);

  useEffect(() => {
    onDataChangeRef.current = onDataChange;
  }, [onDataChange]);

  const setDataAndNotify = useCallback(
    (nextData: ParentPortalData) => {
      setData(nextData);
      onDataChangeRef.current?.(nextData);
    },
    []
  );

  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  const loadData = useCallback(
    async (studentId = studentFilter): Promise<void> => {
      if (!remoteEnabled) {
        setData(initialData);
        return;
      }
      try {
        setDataAndNotify(await fetchParentPortalData(api, studentId));
      } catch (error) {
        onError(toUiErrorMessage(error, UI_MESSAGES.loadError));
      }
    },
    [api, initialData, onError, remoteEnabled, setDataAndNotify, studentFilter]
  );

  useEffect(() => {
    if (!remoteEnabled) return;
    let isMounted = true;

    fetchParentPortalData(api, "")
      .then((nextData) => {
        if (isMounted) setDataAndNotify(nextData);
      })
      .catch((error) => {
        if (isMounted) {
          onError(toUiErrorMessage(error, UI_MESSAGES.loadError));
        }
      });

    return () => {
      isMounted = false;
    };
  }, [api, onError, remoteEnabled, setDataAndNotify]);

  const submitFilters = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    await loadData(studentFilter);
  };

  const resetFilters = async (): Promise<void> => {
    setStudentFilter("");
    await loadData("");
  };

  return {
    data,
    loadData,
    resetFilters,
    setStudentFilter,
    studentFilter,
    submitFilters
  };
};
