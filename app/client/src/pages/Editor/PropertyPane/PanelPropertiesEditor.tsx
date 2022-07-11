import React, { useEffect, useMemo } from "react";
import { useSelector } from "react-redux";

import { WidgetProps } from "widgets/BaseWidget";
import {
  PanelConfig,
  PropertyPaneConfig,
  PropertyPaneControlConfig,
  PropertyPaneSectionConfig,
} from "constants/PropertyControlConstants";
import PropertyControlsGenerator from "./Generator";
import { getWidgetPropsForPropertyPane } from "selectors/propertyPaneSelectors";
import { get, isNumber, isPlainObject, isString } from "lodash";
import { IPanelProps } from "@blueprintjs/core";
import { EditorTheme } from "components/editorComponents/CodeEditor/EditorConfig";
import PropertyPaneTitle from "../PropertyPaneTitle";
import { BindingText } from "../APIEditor/Form";
import QuestionIcon from "remixicon-react/QuestionLineIcon";
import { SearchVariant } from "components/ads";
import { StyledSearchInput } from "./PropertyPaneView";
import { PropertyPaneTab } from "./PropertyPaneTab";
import { selectFeatureFlags } from "selectors/usersSelectors";
import styled from "styled-components";

const PanelWrapper = styled.div`
  margin-top: 52px;
`;

function PanelHeader(props: PanelHeaderProps) {
  return (
    <div
      onClick={(e: any) => {
        e.stopPropagation();
      }}
    >
      <PropertyPaneTitle
        actions={[
          {
            tooltipContent: (
              <div>
                <span>You can connect data from your API by adding </span>
                <BindingText>{`{{apiName.data}}`}</BindingText>
                <span> to a widget property</span>
              </div>
            ),
            icon: <QuestionIcon className="w-4 h-4 text-gray-500" />,
            tooltipPosition: "bottom-right",
          },
        ]}
        isPanelTitle
        onBackClick={props.closePanel}
        title={props.title}
        updatePropertyTitle={props.updatePropertyTitle}
      />
    </div>
  );
}

const updateConfigPaths = (config: PropertyPaneConfig[], basePath: string) => {
  return config.map((_childConfig) => {
    const childConfig = Object.assign({}, _childConfig);
    // TODO(abhinav): Figure out a better way to differentiate between section and control
    if (
      (childConfig as PropertyPaneSectionConfig).sectionName &&
      childConfig.children
    ) {
      (childConfig as PropertyPaneSectionConfig).propertySectionPath = basePath;
      childConfig.children = updateConfigPaths(childConfig.children, basePath);
    } else {
      (childConfig as PropertyPaneControlConfig).propertyName = `${basePath}.${
        (childConfig as PropertyPaneControlConfig).propertyName
      }`;
    }
    return childConfig;
  });
};

export function PanelPropertiesEditor(
  props: PanelPropertiesEditorProps &
    PanelPropertiesEditorPanelProps &
    IPanelProps,
) {
  const featureFlags = useSelector(selectFeatureFlags);
  const widgetProperties: any = useSelector(getWidgetPropsForPropertyPane);

  const {
    closePanel,
    panelConfig,
    panelParentPropertyPath,
    panelProps,
    theme,
  } = props;

  // This could be the id of the parent to access the path
  // For example: `someProperty[<thisValue>]`
  // or the index of the parent to access the path
  // For example: `someProperty.<thisValue>`
  const currentIndex = useMemo(() => {
    const parentProperty = get(widgetProperties, panelParentPropertyPath);
    if (parentProperty) {
      if (isPlainObject(parentProperty)) {
        return panelProps[panelConfig.panelIdPropertyName];
      } else if (Array.isArray(parentProperty)) {
        const currentIndex = parentProperty.findIndex(
          (entry) =>
            panelProps[panelConfig.panelIdPropertyName] ===
            entry[panelConfig.panelIdPropertyName],
        );
        return currentIndex;
      }
    }
    return;
  }, [widgetProperties, panelParentPropertyPath, panelProps, panelConfig]);

  const panelConfigs = useMemo(() => {
    if (currentIndex !== undefined) {
      let path: string | undefined = undefined;
      if (isString(currentIndex)) {
        path = `${panelParentPropertyPath}.${currentIndex}`;
      } else if (isNumber(currentIndex)) {
        path = `${panelParentPropertyPath}[${currentIndex}]`;
      }
      const configChildren = [...panelConfig.children];
      return path ? updateConfigPaths(configChildren, path) : configChildren;
    }
  }, [currentIndex, panelConfig, panelParentPropertyPath]);

  // TODO(aswathkk): Once we remove the PROPERTY_PANE_GROUPING flag, rename this to panelConfigs
  const panelConfigsWithStyleAndContent = useMemo(() => {
    if (
      currentIndex !== undefined &&
      panelConfig.contentChildren &&
      panelConfig.styleChildren
    ) {
      let path: string | undefined = undefined;
      if (isString(currentIndex)) {
        path = `${panelParentPropertyPath}.${currentIndex}`;
      } else if (isNumber(currentIndex)) {
        path = `${panelParentPropertyPath}[${currentIndex}]`;
      }
      const contentChildren = [...panelConfig.contentChildren];
      const styleChildren = [...panelConfig.styleChildren];
      return {
        content: path
          ? updateConfigPaths(contentChildren, path)
          : contentChildren,
        style: path ? updateConfigPaths(styleChildren, path) : styleChildren,
      };
    }
  }, [currentIndex, panelConfig, panelParentPropertyPath]);

  const panel = useMemo(
    () => ({
      openPanel: props.openPanel,
      closePanel: props.closePanel,
    }),
    [props.openPanel, props.closePanel],
  );

  useEffect(() => {
    if (panelProps.propPaneId !== widgetProperties.widgetId) {
      props.closePanel();
    }
  }, [widgetProperties.widgetId]);

  if (!widgetProperties) return null;
  const updatePropertyTitle = (title: string) => {
    if (panelConfig.titlePropertyName) {
      const propertiesToUpdate: Record<string, unknown> = {};
      let path: string | undefined = undefined;
      if (isString(currentIndex)) {
        path = `${panelParentPropertyPath}.${currentIndex}.${panelConfig.titlePropertyName}`;
      } else if (isNumber(currentIndex)) {
        path = `${panelParentPropertyPath}[${currentIndex}].${panelConfig.titlePropertyName}`;
      }
      if (path) {
        propertiesToUpdate[path] = title;
        if (panelConfig.updateHook) {
          const additionalPropertiesToUpdate = panelConfig.updateHook(
            widgetProperties,
            path,
            title,
          );
          additionalPropertiesToUpdate?.forEach(
            ({ propertyPath, propertyValue }) => {
              propertiesToUpdate[propertyPath] = propertyValue;
            },
          );
        }
        props.onPropertiesChange(propertiesToUpdate);
      }
    }
  };

  return (
    <div className="w-full overflow-y-auto">
      <PanelHeader
        closePanel={closePanel}
        isEditable={panelConfig.editableTitle}
        propertyName={panelConfig.titlePropertyName}
        title={panelProps[panelConfig.titlePropertyName]}
        updatePropertyTitle={updatePropertyTitle}
      />
      {featureFlags.PROPERTY_PANE_GROUPING &&
      (panelConfigsWithStyleAndContent?.content ||
        panelConfigsWithStyleAndContent?.style) ? (
        <>
          <StyledSearchInput
            fill
            placeholder="Search for controls, labels etc"
            variant={SearchVariant.BACKGROUND}
          />
          <PropertyPaneTab
            contentComponent={
              panelConfigsWithStyleAndContent?.content ? (
                <PanelWrapper>
                  <PropertyControlsGenerator
                    config={panelConfigsWithStyleAndContent.content}
                    id={widgetProperties.widgetId}
                    panel={panel}
                    theme={theme}
                    type={widgetProperties.type}
                  />
                </PanelWrapper>
              ) : null
            }
            styleComponent={
              panelConfigsWithStyleAndContent.style ? (
                <PanelWrapper>
                  <PropertyControlsGenerator
                    config={panelConfigsWithStyleAndContent.style}
                    id={widgetProperties.widgetId}
                    panel={panel}
                    theme={theme}
                    type={widgetProperties.type}
                  />
                </PanelWrapper>
              ) : null
            }
          />
        </>
      ) : (
        panelConfigs && (
          <PanelWrapper>
            <PropertyControlsGenerator
              config={(panelConfig as unknown) as PropertyPaneConfig[]}
              id={widgetProperties.widgetId}
              panel={panel}
              theme={theme}
              type={widgetProperties.type}
            />
          </PanelWrapper>
        )
      )}
    </div>
  );
}

interface PanelPropertiesEditorProps {
  panelProps: any;
  onPropertiesChange: (updates: Record<string, unknown>) => void;
  panelParentPropertyPath: string;
  theme: EditorTheme;
}

interface PanelPropertiesEditorPanelProps {
  panelConfig: PanelConfig;
}

interface PanelHeaderProps {
  isEditable: boolean;
  widgetProperties?: WidgetProps;
  title: string;
  closePanel: () => void;
  propertyName: string;
  updatePropertyTitle: (title: string) => void;
}

export default PanelPropertiesEditor;
