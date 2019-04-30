import * as React from "react";
import * as d3 from "d3";
import _ from "lodash";
import {SessionGroupData} from "../../shared/api/ComparisonGroupClient";
import {
    ComparisonGroup, convertPatientsStudiesAttrToSamples, excludePatients,
    excludeSamples,
    intersectPatients,
    intersectSamples, unionPatients,
    unionSamples
} from "./GroupComparisonUtils";
import ComplexKeyGroupsMap from "../../shared/lib/complexKeyDataStructures/ComplexKeyGroupsMap";
import {Sample} from "../../shared/api/generated/CBioPortalAPI";

export function getExcludedIndexes(combination:number[], numGroupsTotal:number) {
    // get all indexes not in the given combination

    const excl = [];
    for (let i=0; i<numGroupsTotal; i++) {
        if (!combination.includes(i)) {
            excl.push(i);
        }
    }
    return excl;
}

export function joinNames(names:string[], conj:string) {
    switch (names.length) {
        case 1:
            return <strong>{names[0]}</strong>;
        case 2:
            return <span><strong>{names[0]}</strong> {conj} <strong>{names[1]}</strong></span>;
        case 3:
        default:
            return <span><strong>{names[0]}</strong>, <strong>{names[1]}</strong>, {conj} <strong>{names[2]}</strong></span>;
    }
}

export function blendColors(colors:string[]) {
    // helper function for venn diagram drawing. In order to highlight set complements,
    //  we draw things from the bottom up - the visual exclusion simulates the complement,
    //  even though we don't explicitly draw the set complements in SVG. In order to make
    //  this work, no element can have less than 1 opacity - it would show that the entire
    //  set, not just the complement, is being highlighted and ruin the effect. Therefore...

    // TL;DR: We use this function to blend colors between groups, for the intersection regions.

    if(colors.length == 1){
        return colors[0]; 
    }
    // blend between the first two, 
    // then iteratively blend the next one with the previously blended color
    return _.reduce(colors.slice(2), (blendedColor, nextColor) => {
        return d3.interpolateLab(blendedColor, nextColor)(0.5);
    }, d3.interpolateLab(colors[0], colors[1])(0.5));
}

export function toggleRegionSelected(
    regionComb:number[],
    selectedRegions:number[][]
) {
    const withoutComb = selectedRegions.filter(r=>!_.isEqual(r, regionComb));
    if (withoutComb.length === selectedRegions.length) {
        // combination currently not selected, so add it
        return selectedRegions.concat([regionComb]);
    } else {
        // combination was selected, so return version without it
        return withoutComb;
    }
}

export function regionIsSelected(
    regionComb:number[],
    selectedRegions:number[][]
) {
    return !!selectedRegions.find(r=>_.isEqual(r, regionComb));
}

export function getTextColor(
    backgroundColor:string,
    inverse:boolean=false
) {
    const colors = ["black", "white"];
    let colorIndex = 1;
    if (d3.hsl(backgroundColor).l > 0.179) {
        // if luminance is high, use black text
        // https://stackoverflow.com/questions/3942878/how-to-decide-font-color-in-white-or-black-depending-on-background-color
        colorIndex = 0;
    }
    if (inverse) {
        colorIndex += 1;
    }
    return colors[colorIndex % 2];
}

export function getStudiesAttrForSampleOverlapGroup(
    availableGroups:ComparisonGroup[],
    includedRegions:string[][], // uid[][],
    allGroupsInVenn:string[] // uid[]
) {
    // compute set operations to find contents
    const groups = _.keyBy(availableGroups, g=>g.uid);
    let studiesAttr:SessionGroupData["studies"] = [];
    for (const region of includedRegions) {
        let regionStudiesAttr:SessionGroupData["studies"] = groups[region[0]].studies;
        // intersect
        for (let i=1; i<region.length; i++) {
            regionStudiesAttr = intersectSamples(regionStudiesAttr, groups[region[i]].studies);
        }
        // exclude
        for (const uid of allGroupsInVenn) {
            if (!region.includes(uid)) {
                regionStudiesAttr = excludeSamples(regionStudiesAttr, groups[uid].studies);
            }
        }
        studiesAttr = unionSamples(studiesAttr, regionStudiesAttr);
    }
    return studiesAttr;
}

export function getStudiesAttrForPatientOverlapGroup(
    availableGroups:ComparisonGroup[],
    includedRegions:string[][], // uid[][]
    allGroupsInVenn:string[], // uid[]
    patientToSamplesSet:ComplexKeyGroupsMap<Sample>
) {
    // compute set operations to find contents
    const groups = _.keyBy(availableGroups, g=>g.uid);
    let studiesAttr:{ id:string, patients:string[]}[] = [];
    for (const region of includedRegions) {
        let regionStudiesAttr:{ id:string, patients:string[]}[] = groups[region[0]].studies;
        // intersect
        for (let i=1; i<region.length; i++) {
            regionStudiesAttr = intersectPatients(regionStudiesAttr, groups[region[i]].studies);
        }
        // exclude
        for (const uid of allGroupsInVenn) {
            if (!region.includes(uid)) {
                regionStudiesAttr = excludePatients(regionStudiesAttr, groups[uid].studies);
            }
        }
        studiesAttr = unionPatients(studiesAttr, regionStudiesAttr);
    }
    return convertPatientsStudiesAttrToSamples(studiesAttr, patientToSamplesSet);
}